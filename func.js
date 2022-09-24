/*
 * Copyright (c) 2022 ACOAUTO Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: func.js function template.
 *
 * Author: Han.hui <hanhui@acoinfo.com>
 *
 */

/* Configure */
const CONF = global.CONF;

/*
 * JSON parse
 */
exports.JSON_PARSE = 
`/*
 * Deserialize the JSON string into a structure '${CONF.struct.name}'
 */
bool ${CONF.name}_json_parse (struct ${CONF.struct.name} *des, const char *str, size_t len)`;

/*
 * Parse free
 */
exports.PARSE_FREE = 
`/*
 * Free ${CONF.name}_json_parse() buffer, Warning: string type member can no longer be used
 */
void ${CONF.name}_json_parse_free (struct ${CONF.struct.name} *des)`;

/*
 * JSON stringify
 */
exports.JSON_STRINGIFY = 
`/*
 * Serialize the structure '${CONF.struct.name}' into a JSON string
 */
char *${CONF.name}_json_stringify (const struct ${CONF.struct.name} *des)`;

/*
 * Stringify free
 */
exports.STRINGIFY_FREE = 
`/*
 * Free ${CONF.name}_json_stringify() return value
 */
void ${CONF.name}_json_stringify_free (char *str)`;

/*
 * Function Object declaration
 */
exports.FUNCTION_OBJECT_DECLARATION = 
`/*
 * Serialize and Deserialize function declaration of substructure
 */`;
