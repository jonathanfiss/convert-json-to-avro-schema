// Modules
const Type = require('type-of-is')
const yaml = require('js-yaml');

const minInteger = -2147483648
const maxInteger = 2147483647
const minLong = -9223372036854775808
const maxLong = 9223372036854775807
const base64Regex = /^[A-Za-z0-9+/=]+=$/;
/*
 * @param {any} json
 * @returns {object} a avro schema
*/
module.exports = function convert(json, options) {

    json = JSON.parse(json)
    var processOutput
    var output = {}

    // Set initial object type
    output.type = Type.string(json).toLowerCase()

    if (output.type === 'object') {
        processOutput = processObject(json, options)
        output.type = processOutput.type
        output.properties = processOutput.properties
    }
    if (output.type === 'array') {
        processOutput = processArray(json, options)
        output.type = processOutput.type
        output.items = processOutput.items
    }
    let response = initialStructureAvro(output)
    return JSON.stringify(response, null, 4)
}


function processObject(object, options, output, nested) {
    if (nested && output) {
        output = { properties: output }
    } else {
        output = output || {}
        output.type = getPropertyType(object)
        output.properties = output.properties || {}
    }

    for (var key in object) {
        var value = object[key]
        var type = getPropertyType(value)
        // var format = getPropertyFormat(value, type)

        type = type === 'undefined' ? 'null' : type

        if (type === 'object') {
            output.properties[key] = processObject(value, options, output.properties[key])
            continue
        }

        if (type === 'array') {
            output.properties[key] = processArray(value, options, output.properties[key])
            continue
        }

        if (output.properties[key]) {
            var entry = output.properties[key]
            var hasTypeArray = Array.isArray(entry.type)

            // When an array already exists, we check the existing
            // type array to see if it contains our current property
            // type, if not, we add it to the array and continue
            if (hasTypeArray && entry.type.indexOf(type) < 0) {
                entry.type.push(type)
            }

            // When multiple fields of differing types occur,
            // datatype schema states that the field must specify the
            // primitive types the field allows in array format.
            if (!hasTypeArray && entry.type !== type) {
                entry.type = [entry.type, type]
            }

            continue
        }
        output.properties[key] = {}
        output.properties[key].type = type

        if (options.example && !options.separateExample) {
            output.properties[key].example = value
        }

        if (!options.required) {
            output.properties[key].required = false
        }

        // if (format) {
        //     output.properties[key].format = format
        // }
    }

    return nested ? output.properties : output
}

function processArray(array, options, output, nested) {
    var format
    var oneOf
    var type
    var value = []
    var simpleArray

    if (nested && output) {
        output = { items: output }
    } else {
        output = output || {}
        output.type = getPropertyType(array)
        output.items = output.items || {}
        type = output.items.type || null
    }

    // Determine whether each item is different
    for (var arrIndex = 0, arrLength = array.length; arrIndex < arrLength; arrIndex++) {
        var elementType = getPropertyType(array[arrIndex])
        // var elementFormat = getPropertyFormat(array[arrIndex], elementType)

        if (type && elementType !== type) {
            output.items.oneOf = []
            oneOf = true
            break
        } else {
            type = elementType
            // format = elementFormat
        }
    }

    // Setup type otherwise
    if (!oneOf && type) {
        output.items.type = type
        // if(arrLength >= 0){
        //     output.items.example = array[0]
        // }
        if (format) {
            output.items.format = format
        }
    } else if (oneOf && type !== 'object') {
        output.items = {
            oneOf: [{ type: type }],
            // required: output.items.required
        }
    }

    // Process each item depending
    if (typeof output.items.oneOf !== 'undefined' || type === 'object') {
        for (var itemIndex = 0, itemLength = array.length; itemIndex < itemLength; itemIndex++) {
            var value = array[itemIndex]
            var itemType = getPropertyType(value)
            // var itemFormat = getPropertyFormat(value, itemType)
            var arrayItem
            if (itemType === 'object') {
                // if (output.items.properties) {
                // output.items.required = getUniqueKeys(output.items.properties, value, output.items.required)
                // }
                simpleArray = false
                arrayItem = processObject(value, options, oneOf ? {} : output.items.properties, true)
            } else if (itemType === 'array') {
                simpleArray = false
                arrayItem = processArray(value, options, oneOf ? {} : output.items.properties, true)
            } else {
                arrayItem = {}
                arrayItem.type = itemType
                simpleArray = true
                if (itemFormat) {
                    arrayItem.format = itemFormat
                }
            }
            if (oneOf) {
                var childType = Type.string(value).toLowerCase()
                var tempObj = {}
                if (!arrayItem.type && childType === 'object') {
                    tempObj.properties = arrayItem
                    tempObj.type = 'object'
                    arrayItem = tempObj
                }
                output.items.oneOf.push(arrayItem)
            } else {
                if (output.items.type !== 'object') {
                    continue;
                }
                output.items.properties = arrayItem
            }
        }
    }
    return nested ? output.items : output
}

function isNumberInRange(value, min, max) {
    return value >= min && value <= max;
}

function numberType(value) {
    if (Number.isInteger(value)) {
        if (isNumberInRange(value, minInteger, maxInteger)) {
            return 'int'
        } else if (isNumberInRange(value, minLong, maxLong)) {
            return 'long'
        } else {
            return 'string'
        }
    } else {
        return 'double'
    }
}

function isBase64(str) {
    return base64Regex.test(str);
}

function getPropertyType(value) {
    var type = Type.string(value).toLowerCase()

    switch (type) {
        case 'number':
            type = numberType(value)
            break;
        case 'date':
        case 'regexp':
        case 'error':
        case 'function':
            type = 'string'
            break;
        case 'string':
            type = isBase64(value) ? 'bytes' : 'string'
    }

    return type
}


function getPropertyFormat(value, type) {
    // var type = Type.string(value).toLowerCase()

    if (type === 'datetime') {
        if (patternDateTimeRFC.test(value)) {
            return 'rfc2616'
        }
    }

    return null
}

function initialStructureAvro(fields) {
    return {
        'type': 'record',
        'name': 'GeneratedAvroSchema',
        'namespace': 'com.group.generatedAvroSchema',
        'doc': 'Here you can give more details about the use of this schema',
        'fields': [fields]
    }
}
