# Subunion Member
Each structure member is called an `item`, this `item` can have the following description.

Protocol types:

Name|Full Name|Describe
---|---|---
bfvp|Bit field value protocol|Utilizing 'union' to achieve rapid conversion of 'struct' and individual data
...|...|...

# Bit field value protocol

``` C
// bfvp:
union order1
{
    uint16_t word;
    struct
    {
#if BYTE_ORDER == BIG_ENDIAN
        uint32_t code1	:4;
        uint32_t code2	:5;
        uint32_t code3	:7;
#else
        uint32_t code3	:7;
        uint32_t code2	:5;
        uint32_t code1	:4;
#endif
    }block;
};
```

## item.name
+ *{String}*

The name of the C union.

**This field is required**.

## item.protocol
+ *{String}*

The protocol of the C union., the accepted types include:
`'bfvp'`.

**This field is required**.

## item.key
+ *{String}*

Value occupying the same space as the `'struct'`.

**This field is required**.

## item.type
+ *{String}*

The type of the `'key'`, The type of the member of this structure, the value of this field must be equal to the sum of all subitems 'bit' in `'item.struct'`, the accepted types include: the accepted types include:
`'int8_t'`, `'int16_t'`, `'int32_t'`, `'uint8_t'`, `'uint16_t'`, `'uint32_t'`, `'int'`.

**This field is required**.

## item.struct
+ *{String}*

The name of the C structure.

**This field is required**.

## item.member
+ *{Number}*

Struct member array. Each structure member is an object, which is used to describe the name, type and other information of this member.

**This field is required**.

## item.member.key
+ *{Number}*

The name of the member of this structure, the member name in the generated structure and the corresponding JSON object key. 

**This field is required**.

## item.member.type
+ *{Number}*

The type of the member of this structure, the accepted types include:
`'int8_t'`, `'int16_t'`, `'int32_t'`, `'uint8_t'`, `'uint16_t'`, `'uint32_t'`, `'int'`.

**This field is required**.

## item.member.req
+ *{Boolean}*

Whether this struct member must exist when parsing JSON. When it is `false`, it means that if this member does not exist in JSON, it will be ignored during parsing. If it is `true`, if this member does not exist in JSON, the parsing function will return an error. **default: false**.

**This field is optional**.

## item.member.bit
+ *{Integer}*

The bits of the member of this structure.

**This field is required**.

## item.member.min
+ *{Number}*

If this member is a numeric type member, the minimum value allowed in JSON parsing.

**This field is optional**.

## item.member.max
+ *{Number}*

If this member is a numeric type member, the maximum value allowed in JSON parsing.

**This field is optional**.

## item.member.near
+ *{Boolean}*

If `item.min` or `item.max` exists, this field indicates the processing method when this member exceeds the limit when JSON is parsed. When it is `false`, it means that the parsing fails when the limit is exceeded, and when it is `true`, it means that it exceeds the limit that use limit value. **default: false**.

**This field is optional**.