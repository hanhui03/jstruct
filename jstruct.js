/*
 * Copyright (c) 2021 ACOAUTO Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: jstruct.js JSON <-> C struct tool use cJSON library.
 *
 * Author: Han.hui <hanhui@acoinfo.com>
 *
 * Version: 1.0.2
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
	var ARGUMENT = process.argv[2];
}
if (typeof ARGUMENT !== 'string') {
	ARGUMENT = 'conf.json';
}

/*
 * Config Object
 */
if (typeof fs.load === 'function') {
	var CONF = fs.load(ARGUMENT);
} else {
	var CONF = JSON.parse(fs.readFileSync(ARGUMENT, { encoding: 'utf-8' }));
}
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

	if(struct.hasOwnProperty("substruct")) {
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
			if(item.type === 'struct') {
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
#ifndef STRUCT_${CONF.name.toUpperCase()}_DEFINED
#define STRUCT_${CONF.name.toUpperCase()}_DEFINED
${gen_struct_def(CONF.struct, CONF.struct.substruct ? CONF.struct.substruct:'', false)}
#endif /* STRUCT_${CONF.name.toUpperCase()}_DEFINED */
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
`static bool   ${itemst.name}_json_object_parse(struct ${itemst.name} *, cJSON *);
static cJSON *${itemst.name}_json_object_stringify(const struct ${itemst.name} *);\n`;
		struct_names.push(itemst.name);
	}
	return `${body}`;
}

/*
 * Generate function
 */
function gen_sub_func(FUNC) {
	var body = FUNC.FUNCTION_OBJECT_DECLARATION;
	body += `
${gen_func_def(CONF.struct.substruct ? CONF.struct.substruct:'')}\n`;
	return body;
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

/*
 * Generate assign
 */
function gen_assign(item, target, functype, indentation) {
	if (functype === 'Number' && 
		(typeof item.min === 'number' || typeof item.max === 'number')) {
		var assign = `v = cJSON_GetNumberValue(item);
${indentation}${gen_range_assign(item, 'v', indentation)}
${indentation}${target} = (${item.type})v;`;
	} else if (functype === 'Object') {
		if(!item.name) {
			throw new Error('Structure "struct" type member must have "name" field!');
		}
		var assign = `if (!${item.name}_json_object_parse(&(${target}), item)) {
${indentation}	goto	error;
${indentation}}`;
	} else {
		var assign = `${target} = (${item.type})cJSON_Get${functype}Value(item);`;
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
	array = cJSON_GetObjectItem(json, "${item.key}");
	if (cJSON_IsArray(array)) {
		sza = cJSON_GetArraySize(array);
		${gen_array_min_len_check(item)}sza = sza > ${item.array} ? ${item.array} : sza;
		for (i = 0; i < sza; i++) {
			item = cJSON_GetArrayItem(array, i);
			if (cJSON_Is${functype}(item)) {
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
	item = cJSON_GetObjectItem(json, "${item.key}");
	if (item && cJSON_Is${functype}(item)) {
		${gen_assign(item, `des->${item.key}`, functype, '\t\t')}
	}${failed}\n`;
	return deserial;
}

/*
 * Generate deserial
 */
function gen_deserial(item, functype) {
	if (item.array) {
		var deserial = gen_array_deserial(item, functype);
	} else {
		var deserial = gen_item_deserial(item, functype);
	}
	return deserial;
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
				deserial += gen_deserial(item, 'Bool');
				break;
			case 'int8_t':
			case 'int16_t':
			case 'int32_t':
			case 'uint8_t':
			case 'uint16_t':
			case 'uint32_t':
			case 'int':
			case 'long':
			case 'float':
			case 'double':
				deserial += gen_deserial(item, 'Number');
				break;
			case 'char *':
				deserial += gen_deserial(item, 'String');
				break;
			case 'struct':
				deserial += gen_deserial(item, 'Object');
				break;
		}
	}

	body += `
{
	int i, sza;
	register double v;
	cJSON *json, *item, *array;

	(void)i;
	(void)v;
	(void)sza;
	(void)item;
	(void)array;

	json = cJSON_ParseWithLength(str, len);
	if (!json) {
		return	(false);
	}
${deserial}
	des->json = (void *)json;
	return	(true);

error:
	cJSON_Delete(json);
	return	(false);
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
				deserial += gen_deserial(item, 'Bool');
				break;
			case 'int8_t':
			case 'int16_t':
			case 'int32_t':
			case 'uint8_t':
			case 'uint16_t':
			case 'uint32_t':
			case 'int':
			case 'long':
			case 'float':
			case 'double':
				deserial += gen_deserial(item, 'Number');
				break;
			case 'char *':
				deserial += gen_deserial(item, 'String');
				break;
			case 'struct':
				deserial += gen_deserial(item, 'Object');
				break;
		}
	}

	body += `
/*
 * Deserialize the JSON Object into a substructure '${struct.name}'
 */
static bool ${struct.name}_json_object_parse (struct ${struct.name} *des, cJSON *json)
{
	int i, sza;
	register double v;
	cJSON *item, *array;

	(void)i;
	(void)v;
	(void)sza;
	(void)item;
	(void)array;

	if (!des || !json) {
		return	(false);
	}
${deserial}
	return	(true);

error:
	return	(false);
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
		cJSON_Delete((cJSON *)des->json);
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
	if (functype === 'String') {
		var value = `des->${item.key}[i] ? des->${item.key}[i] : ""`;
	} else {
		var value = `des->${item.key}[i]`;
	}
	var serial = `
	array = cJSON_CreateArray();
	if (!array) {
		goto	error;
	}
	for (i = 0; i < ${item.array}; i++) {`;
	if (functype === 'Object') {
		serial += `
		item = ${item.name}_json_object_stringify(&(${value}));`;
	} else {
		serial += `
		item = cJSON_Create${functype}(${value});`;
	}
	serial += `
		if (!item) {
			cJSON_Delete(array);
			goto	error;
		}
		if (!cJSON_AddItemToArray(array, item)) {
			cJSON_Delete(item);
			cJSON_Delete(array);
			goto	error;
		}
	}
	item = array;`;
	return serial;
}

/*
 * Generate item serial
 */
function gen_item_serial(item, functype) {
	if (functype === 'String') {
		var value = `des->${item.key} ? des->${item.key} : ""`;
	} else {
		var value = `des->${item.key}`;
	}
	if (functype === 'Object') {
		var serial = `
	item = ${item.name}_json_object_stringify(&(${value}));
	if (!item) {
		goto	error;
	}`;
	} else {
		var serial = `
	item = cJSON_Create${functype}(${value});
	if (!item) {
		goto	error;
	}`;
	}
	
	return serial;
}

/*
 * Generate serial
 */
function gen_serial(item, functype) {
	if (item.array) {
		var serial = gen_array_serial(item, functype);
	} else {
		var serial = gen_item_serial(item, functype);
	}
	serial += `
	if (!cJSON_AddItemToObject(json, "${item.key}", item)) {
		cJSON_Delete(item);
		goto	error;
	}\n`;
	return serial;
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
				serial += gen_serial(item, 'Bool');
				break;
			case 'int8_t':
			case 'int16_t':
			case 'int32_t':
			case 'uint8_t':
			case 'uint16_t':
			case 'uint32_t':
			case 'int':
			case 'long':
			case 'float':
			case 'double':
				serial += gen_serial(item, 'Number');
				break;
			case 'char *':
				serial += gen_serial(item, 'String');
				break;
			case 'struct':
				serial += gen_serial(item, 'Object');
				break;
		}
	}

	body += `
{
	int i;
	char *string;
	cJSON *json, *item, *array;

	(void)i;
	(void)item;
	(void)array;

	if (!des) {
		return	(NULL);
	}

	json = cJSON_CreateObject();
	if (!json) {
		return	(NULL);
	}
${serial}
	string = cJSON_PrintUnformatted(json);
	cJSON_Delete(json);
	return	(string);

error:
	cJSON_Delete(json);
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
				serial += gen_serial(item, 'Bool');
				break;
			case 'int8_t':
			case 'int16_t':
			case 'int32_t':
			case 'uint8_t':
			case 'uint16_t':
			case 'uint32_t':
			case 'int':
			case 'long':
			case 'float':
			case 'double':
				serial += gen_serial(item, 'Number');
				break;
			case 'char *':
				serial += gen_serial(item, 'String');
				break;
			case 'struct':
				serial += gen_serial(item, 'Object');
				break;
			}
	}

	body += `
/*
 * Serialize the substructure '${struct.name}' into a JSON string
 */
static cJSON *${struct.name}_json_object_stringify (const struct ${struct.name} *des)
{
	int i;
	cJSON *json, *item, *array;

	(void)i;
	(void)item;
	(void)array;

	if (!des) {
		return	(NULL);
	}

	json = cJSON_CreateObject();
	if (!json) {
		return	(NULL);
	}
${serial}
	return	(json);

error:
	cJSON_Delete(json);
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
		cJSON_free(str);
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
	if(CONF.struct.hasOwnProperty("substruct")) {
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

output();
