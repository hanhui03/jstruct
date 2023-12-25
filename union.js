/*
 * Copyright (c) 2021 ACOAUTO Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: protocol.js Union <-> C struct tool use cJSON library.
 *
 * Author: Wan.ChunYu <wanchunyu@acoinfo.com>
 *
 * Version: 1.0.3
 *
 */

/*
 * Protocol types:
 * +-------+--------------------------+-------------------------------------------------------------------------------+
 * | Name  | Full Name                | Describe                                                                      |
 * +-------+----------------------------------------------------------------------------------------------------------+
 * | bfvp  | Bit field value protocol | Utilizing 'union' to achieve rapid conversion of 'struct' and individual data |
 * +-------+--------------------------+-------------------------------------------------------------------------------+
 * 
 * bfvp:
 * union order1
 * {
 *     uint16_t word;
 *     struct
 *     {
 * #if BYTE_ORDER == BIG_ENDIAN
 *         uint32_t code1	:4;
 *         uint32_t code2	:5;
 *         uint32_t code3	:7;
 * #else
 *         uint32_t code3	:7;
 *         uint32_t code2	:5;
 *         uint32_t code1	:4;
 * #endif
 *     }block;
 * };
 * 
 */

/* Int Number types include */
const INT_NUMBER_TYPES = [
	'int8_t', 'int16_t', 'int32_t', 'uint8_t', 'uint16_t', 'uint32_t', 'int'
];

/* Union arry */
var union_names = [];

/*
 * Check int number type
 */
function check_int_number_type(type) {
	if (!INT_NUMBER_TYPES.includes(type)) {
		throw new TypeError('Union type error, legal includes:', JSON.stringify(INT_NUMBER_TYPES));
	}
}

/*
 * Check number type bits
 */
function check_bit_sum(type, bit) {
	var number = 0;
	switch (type) {
		case 'int8_t':
		case 'uint8_t':
			number = 8;
			break;
		case 'int16_t':
		case 'uint16_t':
			number = 16;
			break;
		case 'int32_t':
		case 'uint32_t':
		case 'int':
			number = 32;
			break;
		default:
			break;
	}
	if (number !== bit) {
		throw new TypeError(`${type} type is ${number} bits, but your total is ${bit} bits!`);
	}
}

/*
 * Generate error collect
 */
function gen_error(issub) {
	var jdel = issub ? '' : 'yyjson_doc_free(doc);\n\t';
	var error = `\n
error:
	${jdel}return	(false);`;
	return error;
}

/*
 * Generate range assign
 */
function gen_range_assign(item, variable, indentation) {
	var assign = '';
	var handle = undefined;
	if (typeof item.min === 'number') {
		if (item.near) {
			handle = `${variable} = ${item.min};`;
		} else {
			handle = 'goto	error;';
		}
		assign = 
`if (${variable} < ${item.min}) {
${indentation}\t${handle}
${indentation}}`;
	}
	if (typeof item.max === 'number') {
		if (item.near) {
			handle = `${variable} = ${item.max};`;
		} else {
			handle = 'goto	error;';
		}
		if (assign) {
			assign += 
` else if (${variable} > ${item.max}) {
${indentation}\t${handle}
${indentation}}`;
		} else {
			assign = 
`if (${variable} > ${item.max}) {
${indentation}\t${handle}
${indentation}}`;
		}
	}
	return assign;
}

/* Number functype */
const numfuncs = new Set(['int', 'uint', 'real']);

/*
 * Generate assign
 */
function gen_assign(item, target, functype, indentation) {
	if (numfuncs.has(functype) && 
		(typeof item.min === 'number' || typeof item.max === 'number')) {
		var assign = `v = yyjson_get_${functype}(item);
${indentation}${gen_range_assign(item, 'v', indentation)}
${indentation}${target} = (${item.type})v;`;
	} else if (functype === 'obj') {
		if (!item.name) {
			throw new Error('Structure "struct" type member must have "name" field!');
		}
		var assign = `if (!${item.name}_json_object_parse(item, &(${target}))) {
${indentation}	goto	error;
${indentation}}`;
	} else {
		var assign = `${target} = (${item.type})yyjson_get_${functype}(item);`;
	}
	return assign;
}

/*
 * Generate union 'bfvp' define
 */
function gen_union_bfvp_def(itemun) {
	var body = '';
	var big_endian_body = '';
	var little_endian_body = '';
	var interval = ' ';
	var member = itemun.member;
	var bit = 0;
	if (!itemun.type || !itemun.key || !itemun.struct) {
		throw new Error('Protocol "bfvp" must include "type"、"key" and "struct" field!');
	}
	for (var item of member) {
		if (item.key === 'json') {
			throw new Error('Union members are not allowed to be named "json"!');
		}
		if (item.array) {
			throw new Error('Union members are not allowed "array" field!');
		}
		if (!item.bit) {
			throw new Error('Union members must include "bit" field!');
		}
		check_int_number_type(item.type);
		
		big_endian_body += `\t\t${item.type}${interval}${item.key}\t:${item.bit};\n`;
		little_endian_body = `\t\t${item.type}${interval}${item.key}\t:${item.bit};\n` + little_endian_body;
		bit += item.bit;
	}
	check_bit_sum(itemun.type, bit);
	body = `#if BYTE_ORDER == BIG_ENDIAN\n${big_endian_body}#else\n${little_endian_body}#endif\n`
	return `\nunion${interval}${itemun.name}\n{\n\t${itemun.type}${interval}${itemun.key};\n\tstruct\n\t{\n${body}\t}${itemun.struct};\n};\n`;
}

/*
 * Generate json_stringify()
 */
function gen_bfvp_json_object_stringify(union) {
	var body = '';
	var member = union.member;
	var serial = '';
	for (var item of member) {
		switch (item.type) {
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			serial += gen_bfvp_serial(item, union.struct, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			serial += gen_bfvp_serial(item, union.struct, 'uint');
			break;
		}
	}

	body += `
/*
 * Serialize the union '${union.name}' into a JSON string
 */
static yyjson_mut_val *${union.name}_json_object_stringify (yyjson_mut_doc *doc, const union ${union.name} *des)
{
	size_t i;
	yyjson_mut_val *val, *item, *array;

	(void)i;
	(void)item;
	(void)array;

	if (!des) {
		return	(NULL);
	}

	val = yyjson_mut_obj(doc);
	if (!val) {
		return	(NULL);
	}
${serial}
	return	(val);

error:
	return	(NULL);
}\n`;
	return body;
}

/*
 * Generate json_object_parse()
 */
function gen_bfvp_json_object_parse(union) {
	var body = '';
	var member = union.member;
	var deserial = '';
	for (var item of member) {
		switch (item.type) {
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			deserial += gen_bfvp_deserial(item, union.struct, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			deserial += gen_bfvp_deserial(item, union.struct, 'uint');
			break;
		}
	}
	var error = deserial.includes('goto\t') ? gen_error(true) : '';

	body += `
/*
 * Deserialize the JSON Object into a union '${union.name}'
 */
static bool ${union.name}_json_object_parse (yyjson_val *val, union ${union.name} *des)
{
	size_t i, max, sza;
	register double v;
	yyjson_val *item, *array;

	(void)i;
	(void)v;
	(void)max;
	(void)sza;
	(void)item;
	(void)array;

	if (!val || !des) {
		return	(false);
	}
${deserial}
	return	(true);${error}
}\n`;
	return body;
}

/*
 * Generate 'bfvp' serial
 */
function gen_bfvp_serial(item, struct, functype) {
	var value = `des->${struct}.${item.key}`;
	var serial = `
	if (!yyjson_mut_obj_add_${functype}(doc, val, "${item.key}", ${value})) {
		goto	error;
	}\n`;
	return serial;
}

/*
 * Generate 'bfvp' deserial
 */
function gen_bfvp_deserial(item, struct, functype) {
	if (item.req) {
		var failed = ` else {
		goto	error;
	}`;
	} else {
		var failed = '';
	}
	var deserial = `
	item = yyjson_obj_get(val, "${item.key}");
	if (item && yyjson_is_${functype}(item)) {
		${gen_assign(item, `des->${struct}.${item.key}`, functype, '\t\t')}
	}${failed}\n`;
	return deserial;
}

/*
 * Generate union define
 */
function gen_union_def(unionlist) {
	var body = '';
	if (unionlist) {
		for (var itemun of unionlist) {
			if (union_names.indexOf(itemun.name) >= 0) {
				return '';
			}
			switch (itemun.protocol) {
				case 'bfvp':
					body += gen_union_bfvp_def(itemun);
					break;
				default:
					console.info(`Protocol '${itemun.protocol}' is not support!`);
					break;
			}
			union_names.push(itemun.name);
		}
	}
	union_names = [];
	return `${body}`;
}

/*
 * Generate function define
 */
function gen_union_func_def(unionlist) {
	var body = '';
	for (var itemun of unionlist) {
		if (union_names.indexOf(itemun.name) >= 0) {
			continue;
		}
		body += 
`static bool            ${itemun.name}_json_object_parse(yyjson_val *, union ${itemun.name} *);
static yyjson_mut_val *${itemun.name}_json_object_stringify(yyjson_mut_doc *, const union ${itemun.name} *);\n`;
		union_names.push(itemun.name);
	}
	union_names = [];
	return `${body}`;
}

function gen_union_json_object(subunion) {
	var body = '';
	for (var itemun of subunion) {
		if (union_names.indexOf(itemun.name) >= 0) {
			continue;
		}
		switch (itemun.protocol) {
			case 'bfvp':
				body += gen_bfvp_json_object_parse(itemun);
				body += gen_bfvp_json_object_stringify(itemun);
				break;
			default:
				console.info(`Protocol '${itemun.protocol}' is not support!`);
				break;
		}
		union_names.push(itemun.name);
	}
	union_names = [];
	return body;
}

module.exports = {
	gen_union_json_object:gen_union_json_object,
	gen_union_def:gen_union_def,
	gen_union_func_def:gen_union_func_def
}