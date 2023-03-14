/*
 * Copyright (c) 2022 ACOAUTO Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: file.js C & H file template.
 *
 * Author: Han.hui <hanhui@acoinfo.com>
 *
 */

/* Configure */
const CONF = global.CONF;

/*
 * C File Header
 */
exports.C_HEADER = 
`/*
* Copyright (c) 2022 ACOAUTO Team.
* All rights reserved.
*
* Detailed license information can be found in the LICENSE file.
*
* File: ${CONF.name}_jstruct.c ${CONF.name} JSON <-> C struct.
*
* Date: ${new Date().toString()}
*
* This file is automatically generated by the jstruct tool, please do not modify.
*
* Author: Han.hui <hanhui@acoinfo.com>
*
*/

#include <stdlib.h>
#include <string.h>
#include "yyjson.h"
#include "${CONF.name}_jstruct.h"

`;

/*
 * C File Footer
 */
exports.C_FOOTER = 
`/*
 * end
 */
`;

/*
 * H File Header
 */
exports.H_HEADER = 
`/*
* Copyright (c) 2022 ACOAUTO Team.
* All rights reserved.
*
* Detailed license information can be found in the LICENSE file.
*
* File: ${CONF.name}_jstruct.h ${CONF.name} JSON <-> C struct.
*
* Date: ${new Date().toString()}
*
* This file is automatically generated by the jstruct tool, please do not modify.
*
* Author: Han.hui <hanhui@acoinfo.com>
*
*/

#ifndef ${CONF.name.toUpperCase()}_JSTRUCT_H
#define ${CONF.name.toUpperCase()}_JSTRUCT_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
`;

/*
 * H C++ Extern Start
 */
exports.H_CPP_START = `
#ifdef __cplusplus
extern "C" {
#endif
`;

/*
 * H C++ Extern End
 */
exports.H_CPP_END = `
#ifdef __cplusplus
}
#endif
`;

/*
 * H File Body
 */
exports.H_BODY = `
/* Deserialize the JSON string into a structure '${CONF.struct.name}' */
bool ${CONF.name}_json_parse(struct ${CONF.struct.name} *, const char *, size_t);

/* Free ${CONF.name}_json_parse() buffer, Warning: string type member can no longer be used */
void ${CONF.name}_json_parse_free(struct ${CONF.struct.name} *);

/* Serialize the structure '${CONF.struct.name}' into a JSON string */
char *${CONF.name}_json_stringify(const struct ${CONF.struct.name} *);

/* Free ${CONF.name}_json_stringify() return value */
void ${CONF.name}_json_stringify_free(char *);
`;

/*
 * H File Footer
 */
exports.H_FOOTER = `
#endif /* ${CONF.name.toUpperCase()}_JSTRUCT_H */
/*
 * end
 */
`;
