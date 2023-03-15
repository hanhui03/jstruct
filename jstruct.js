/*
 * Copyright (c) 2021 ACOAUTO Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: jstruct.js JSON <-> C struct tool use yyjson library.
 *
 * Author: Han.hui <hanhui@acoinfo.com>
 *
 * Version: 1.0.3
 *
 */

var fs = require('fs');
var process = require('process');

/* Supported types include */
const STRUCT_TYPES = [
	'bool', 'int8_t', 'int16_t', 'int32_t', 'uint8_t', 'uint16_t', 'uint32_t', 'int', 'long', 'float', 'double', 'char *', 'struct'
];

/* Struct arry */
var struct_names = [];

/*
 * Load config
 */
if (typeof __filename === 'string') {
	var config = process.argv[2];
} else if (typeof ARGUMENT === 'string') {
	var config = ARGUMENT;
} else {
	var config = 'conf.json';
}

/*
 * YAML preprocessing
 */
if (config.endsWith('.yaml')) {
	try {
		var YAML = require('yaml');
	} catch {
		console.error('YAML module not found, please install using: npm i yaml');
		process.exit(-1);
	}
	if (typeof fs.load === 'function') {
		var CONF = YAML.parse(fs.readFile(config, { encoding: 'utf-8' }));
	} else {
		var CONF = YAML.parse(fs.readFileSync(config, { encoding: 'utf-8' }));
	}
} else {
	if (typeof fs.load === 'function') {
		var CONF = fs.load(config);
	} else {
		var CONF = JSON.parse(fs.readFileSync(config, { encoding: 'utf-8' }));
	}
}

/*
 * Config Object
 */
if (CONF) {
	global.CONF = CONF;
} else {
	console.error('Configure file error!');
	process.exit(-1);
}

/*
 * File template
 */
const FILE = require('./file');

/*
 * Function template
 */
const FUNC = require('./func');

/*
 * Check type
 */
function check_type(type) {
	if (!STRUCT_TYPES.includes(type)) {
		throw new TypeError('Structure type error, legal includes:', JSON.stringify(STRUCT_TYPES));
	}
}

/*
 * Generate structure define
 */
function gen_struct_def(struct, structlist, issub) {
	if (struct_names.indexOf(struct.name) >= 0) {
		return '';
	}

	var member = struct.member;
	var body = '';
	var subbody = '';
	var interval = '';
	if (struct.hasOwnProperty("substruct")) {
		for (var itemst of structlist) {
			subbody += gen_struct_def(itemst, structlist, true);
		}
	}

	for (var item of member) {
		if (item.key === 'json') {
			throw new Error('Structure members are not allowed to be named "json"!');
		}
		check_type(item.type);
		if (item.type == 'struct') {
			if (struct_names.indexOf(item.name) < 0) {
				for (var itemst of structlist) {
					if (itemst.name == item.name) {
						subbody += gen_struct_def(itemst, structlist, true);
					}
				}
			}
		}
		interval = item.type.endsWith('*') ? '' : ' ';
		if (item.array) {
			if (item.type === 'struct') {
				body += `\t${item.type}${interval}${item.name}${interval}${item.key}[${item.array}];\n`;
			} else {
				body += `\t${item.type}${interval}${item.key}[${item.array}];\n`;
			}
		} else {
			if (item.type === 'struct') {
				body += `\t${item.type}${interval}${item.name}${interval}${item.key};\n`;
			} else {
				body += `\t${item.type}${interval}${item.key};\n`;
			}
		}
	}
	struct_names.push(struct.name);

	if (issub) {
		return `${subbody}\nstruct ${struct.name} {\n${body}};\n`;
	} else {
		return `${subbody}\nstruct ${struct.name} {\n${body}\tvoid *json;\n};\n`;
	}
}

/*
 * Generate structure
 */
function gen_struct() {
	return `
#ifndef STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED
#define STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED
${gen_struct_def(CONF.struct, CONF.struct.substruct ? CONF.struct.substruct:'', false)}
#endif /* STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED */
`;
}

/*
 * Generate function define
 */
function gen_func_def(structlist) {
	var body = '';
	for (var itemst of structlist) {
		if (struct_names.indexOf(itemst.name) >= 0) {
			continue;
		}
		body += 
`static bool            ${itemst.name}_json_object_parse(yyjson_val *, struct ${itemst.name} *);
static yyjson_mut_val *${itemst.name}_json_object_stringify(yyjson_mut_doc *, const struct ${itemst.name} *);\n`;
		struct_names.push(itemst.name);
	}
	return `${body}`;
}

/*
 * Generate function
 */
function gen_sub_func(FUNC) {
	var defs = gen_func_def(CONF.struct.substruct ? CONF.struct.substruct:'');
	return defs ? `${FUNC.FUNCTION_OBJECT_DECLARATION}\n${defs}\n` : '';
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

/*
 * Generate array min length check
 */
function gen_array_min_len_check(item) {
	if (item.mlen) {
		var check = 
		`if (sza < ${item.mlen}) {
			goto	error;
		}\n\t\t`;
	} else {
		var check = '';
	}
	return check;
}

/* Number functype */
const numfuncs = new Set(['int', 'uint', 'real']);

/*
 * Generate assign
 */
function gen_assign(item, target, functype, indentation) {
	if (numfuncs.has(functype) && 
		(typeof item.min === 'number' || typeof item.max === 'number')) {
		var assign = `v = yyjson_get_real(item);
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
 * Generate array deserial
 */
function gen_array_deserial(item, functype) {
	if (item.req) {
		var failed = ` else {
		goto	error;
	}`;
	} else {
		var failed = '';
	}
	var deserial = `
	array = yyjson_obj_get(val, "${item.key}");
	if (array && yyjson_is_arr(array)) {
		sza = yyjson_arr_size(array);
		${gen_array_min_len_check(item)}sza = sza > ${item.array} ? ${item.array} : sza;
		yyjson_arr_foreach(array, i, max, item) {
			if (i >= sza) {
				break;
			}
			if (yyjson_is_${functype}(item)) {
				${gen_assign(item, `des->${item.key}[i]`, functype, '\t\t\t\t')}
			} else {
				goto	error;
			}
		}
	}${failed}\n`;
	return deserial;
}

/*
 * Generate item deserial
 */
function gen_item_deserial(item, functype) {
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
		${gen_assign(item, `des->${item.key}`, functype, '\t\t')}
	}${failed}\n`;
	return deserial;
}

/*
 * Generate deserial
 */
function gen_deserial(item, functype) {
	return item.array ? gen_array_deserial(item, functype) : gen_item_deserial(item, functype);
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
 * Generate json_parse()
 */
function gen_json_parse(FUNC) {
	var body = FUNC.JSON_PARSE;
	var member = CONF.struct.member;
	var deserial = '';
	for (var item of member) {
		switch (item.type) {
		case 'bool':
			deserial += gen_deserial(item, 'bool');
			break;
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			deserial += gen_deserial(item, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			deserial += gen_deserial(item, 'uint');
			break;
		case 'float':
		case 'double':
			deserial += gen_deserial(item, 'real');
			break;
		case 'char *':
			deserial += gen_deserial(item, 'str');
			break;
		case 'struct':
			deserial += gen_deserial(item, 'obj');
			break;
		}
	}
	var error = deserial.includes('goto\t') ? gen_error(false) : '';

	body += `
{
	size_t i, max, sza;
	register double v;
	yyjson_doc *doc;
	yyjson_val *val, *item, *array;

	(void)i;
	(void)v;
	(void)max;
	(void)sza;
	(void)item;
	(void)array;

	doc = yyjson_read(str, len, YYJSON_READ_NOFLAG);
	if (!doc) {
		return	(false);
	} else {
		val = yyjson_doc_get_root(doc);
	}
${deserial}
	des->json = (void *)doc;
	return	(true);${error}
}\n
`;
	return body;
}

/*
 * Generate json_object_parse()
 */
function gen_json_object_parse(struct) {
	var body = '';
	var member = struct.member;
	var deserial = '';
	for (var item of member) {
		switch (item.type) {
		case 'bool':
			deserial += gen_deserial(item, 'bool');
			break;
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			deserial += gen_deserial(item, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			deserial += gen_deserial(item, 'uint');
			break;
		case 'float':
		case 'double':
			deserial += gen_deserial(item, 'real');
			break;
		case 'char *':
			deserial += gen_deserial(item, 'str');
			break;
		case 'struct':
			deserial += gen_deserial(item, 'obj');
			break;
		}
	}
	var error = deserial.includes('goto\t') ? gen_error(true) : '';

	body += `
/*
 * Deserialize the JSON Object into a substructure '${struct.name}'
 */
static bool ${struct.name}_json_object_parse (yyjson_val *val, struct ${struct.name} *des)
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
 * Generate parse_free()
 */
function gen_parse_free(FUNC) {
	var body = FUNC.PARSE_FREE;
	body += `
{
	if (des && des->json) {
		yyjson_doc_free((yyjson_doc *)des->json);
		des->json = NULL;
	}
}\n
`;
	return body;
}

/*
 * Generate array serial
 */
function gen_array_serial(item, functype) {
	if (functype === 'str') {
		var value = `des->${item.key}[i] ? des->${item.key}[i] : ""`;
	} else {
		var value = `des->${item.key}[i]`;
	}
	var serial = `
	array = yyjson_mut_arr(doc);
	if (!array) {
		goto	error;
	}
	for (i = 0; i < ${item.array}; i++) {`;
	if (functype === 'val') {
		serial += `
		item = ${item.name}_json_object_stringify(doc, &(${value}));
		if (!yyjson_mut_arr_add_val(array, item)) {
			goto	error;
		}`;
	} else {
		serial += `
		if (!yyjson_mut_arr_add_${functype}(doc, array, ${value})) {
			goto	error;
		}`;
	}
	serial += `
	}
	if (!yyjson_mut_obj_add_val(doc, val, "${item.key}", array)) {
		goto	error;
	}\n`;
	return serial;
}

/*
 * Generate item serial
 */
function gen_item_serial(item, functype) {
	if (functype === 'str') {
		var value = `des->${item.key} ? des->${item.key} : ""`;
	} else {
		var value = `des->${item.key}`;
	}
	if (functype === 'val') {
		var serial = `
	item = ${item.name}_json_object_stringify(doc, &(${value}));
	if (!item) {
		goto	error;
	}
	if (!yyjson_mut_obj_add_val(doc, val, "${item.key}", item)) {
		goto	error;
	}\n`;
	} else {
		var serial = `
	if (!yyjson_mut_obj_add_${functype}(doc, val, "${item.key}", ${value})) {
		goto	error;
	}\n`;
	}
	return serial;
}

/*
 * Generate serial
 */
function gen_serial(item, functype) {
	return item.array ? gen_array_serial(item, functype) : gen_item_serial(item, functype);
}

/*
 * Generate json_stringify()
 */
function gen_json_stringify(FUNC) {
	var body = FUNC.JSON_STRINGIFY;
	var member = CONF.struct.member;
	var serial = '';
	for (var item of member) {
		switch (item.type) {
		case 'bool':
			serial += gen_serial(item, 'bool');
			break;
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			serial += gen_serial(item, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			serial += gen_serial(item, 'uint');
			break;
		case 'float':
		case 'double':
			serial += gen_serial(item, 'real');
			break;
		case 'char *':
			serial += gen_serial(item, 'str');
			break;
		case 'struct':
			serial += gen_serial(item, 'val');
			break;
		}
	}

	body += `
{
	int i;
	char *string;
	yyjson_mut_doc *doc;
	yyjson_mut_val *val, *item, *array;

	(void)i;
	(void)item;
	(void)array;

	if (!des) {
		return	(NULL);
	}

	doc = yyjson_mut_doc_new(NULL);
	if (!doc) {
		return	(NULL);
	}

	val = yyjson_mut_obj(doc);
	if (!val) {
		yyjson_mut_doc_free(doc);
		return	(NULL);
	} else {
		yyjson_mut_doc_set_root(doc, val);
	}
${serial}
	string = yyjson_mut_write(doc, YYJSON_WRITE_NOFLAG, NULL);
	yyjson_mut_doc_free(doc);
	return	(string);

error:
	yyjson_mut_doc_free(doc);
	return	(NULL);
}\n
`;
	return body;
}

/*
 * Generate json_stringify()
 */
function gen_json_object_stringify(struct) {
	var body = '';
	var member = struct.member;
	var serial = '';
	for (var item of member) {
		switch (item.type) {
		case 'bool':
			serial += gen_serial(item, 'bool');
			break;
		case 'int':
		case 'long':
		case 'int8_t':
		case 'int16_t':
		case 'int32_t':
			serial += gen_serial(item, 'int');
			break;
		case 'uint8_t':
		case 'uint16_t':
		case 'uint32_t':
			serial += gen_serial(item, 'uint');
			break;
		case 'float':
		case 'double':
			serial += gen_serial(item, 'real');
			break;
		case 'char *':
			serial += gen_serial(item, 'str');
			break;
		case 'struct':
			serial += gen_serial(item, 'val');
			break;
		}
	}

	body += `
/*
 * Serialize the substructure '${struct.name}' into a JSON string
 */
static yyjson_mut_val *${struct.name}_json_object_stringify (yyjson_mut_doc *doc, const struct ${struct.name} *des)
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
 * Generate stringify_free()
 */
function gen_stringify_free(FUNC) {
	var body = FUNC.STRINGIFY_FREE;
	body += `
{
	if (str) {
		free(str);
	}
}\n`;
	return body;
}

/*
 * C merge
 */
function c_merge(FILE, FUNC) {
	var body = FILE.C_HEADER;
	body += gen_sub_func(FUNC);
	struct_names = [];
	body += gen_json_parse(FUNC);
	body += gen_parse_free(FUNC);
	body += gen_json_stringify(FUNC);
	body += gen_stringify_free(FUNC);
	if (CONF.struct.hasOwnProperty("substruct")) {
		for (var itemst of CONF.struct.substruct) {
			if (struct_names.indexOf(itemst.name) >= 0) {
				continue;
			}
			body += gen_json_object_parse(itemst);
			body += gen_json_object_stringify(itemst);
			struct_names.push(itemst.name);
		}
	}
	struct_names = [];
	body += FILE.C_FOOTER;
	return body;
}

/*
 * H merge
 */
function h_merge(FILE) {
	var body = FILE.H_HEADER;
	body += gen_struct();
	struct_names = [];
	body += FILE.H_CPP_START;
	body += FILE.H_BODY;
	body += FILE.H_CPP_END;
	body += FILE.H_FOOTER;
	return body;
}

/*
* Output
*/
function output() {
	var output = undefined;
	output = c_merge(FILE, FUNC);
	fs.writeFile(`./${CONF.name}_jstruct.c`, output, () => {});
	output = h_merge(FILE);
	fs.writeFile(`./${CONF.name}_jstruct.h`, output, () => {});
	console.info(`File: ${CONF.name}_jstruct.c ${CONF.name}_jstruct.h generated!`);
}

/*
 * Go!
 */
output();
