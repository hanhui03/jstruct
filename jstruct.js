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
 */

var fs = require('fs');
var process = require('process');

/* Supported types include */
const STRUCT_TYPES = [
	'bool', 'int8_t', 'int16_t', 'int32_t', 'uint8_t', 'uint16_t', 'uint32_t', 'int', 'long', 'float', 'double', 'char *'
];

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
 * Generate structure
 */
function gen_struct() {
	var member = CONF.struct.member;
	var body = '';
	var interval = '';
	for (var item of member) {
		if (item.key === 'json') {
			throw new Error('Structure members are not allowed to be named "json"!');
		}
		check_type(item.type);
		interval = item.type.endsWith('*') ? '' : ' ';
		if (item.array) {
			body += `\t${item.type}${interval}${item.key}[${item.array}];\n`;
		} else {
			body += `\t${item.type}${interval}${item.key};\n`;
		}
	}
	return `
#ifndef STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED
#define STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED
struct ${CONF.struct.name} {\n${body}\tvoid *json;\n};
#endif /* STRUCT_${CONF.struct.name.toUpperCase()}_DEFINED */`;
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
function gen_json_parse() {
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
 * Generate parse_free()
 */
function gen_parse_free() {
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
	for (i = 0; i < ${item.array}; i++) {
		item = cJSON_Create${functype}(${value});
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
	var serial = `
	item = cJSON_Create${functype}(${value});
	if (!item) {
		goto	error;
	}`;
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
function gen_json_stringify() {
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
 * Generate stringify_free()
 */
function gen_stringify_free() {
	var body = FUNC.STRINGIFY_FREE;
	body += `
{
	if (str) {
		cJSON_free(str);
	}
}\n
`;
	return body;
}

/*
 * C merge
 */
function c_merge() {
	var body = FILE.C_HEADER;
	body += gen_json_parse();
	body += gen_parse_free();
	body += gen_json_stringify();
	body += gen_stringify_free();
	body += FILE.C_FOOTER;
	return body;
}

/*
 * H merge
 */
function h_merge() {
	var body = FILE.H_HEADER;
	body += gen_struct();
	body += FILE.H_FOOTER;
	return body;
}

/*
 * Output
 */
var output = undefined;
output = c_merge();
fs.writeFile(`./${CONF.name}_jstruct.c`, output, () => {});
output = h_merge();
fs.writeFile(`./${CONF.name}_jstruct.h`, output, () => {});
console.info(`File: ${CONF.name}_jstruct.c ${CONF.name}_jstruct.h generated!`);
