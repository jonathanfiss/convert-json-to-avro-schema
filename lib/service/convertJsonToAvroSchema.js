// Modulos
const Type = require('type-of-is')

// Constantes de validação
const minInteger = -2147483648
const maxInteger = 2147483647
const minLong = -9223372036854775808
const maxLong = 9223372036854775807
const base64Regex = /^[A-Za-z0-9+/=]+=$/;
const exempleNamespace = "com.group."
var DRAFT = 'http://json-schema.org/draft-04/schema#'

/*
 * @param {any} json
 * @param {object} json
 * @returns {object} a avro schema
*/

// module.exports = function convert(json, options) {

//     json = JSON.parse(json)
//     var processOutput
//     var output = {
//         'fields': []
//     }

//     // Tipo inicial do json
//     output.type = Type.string(json).toLowerCase()

//     if (output.type === 'object') {
//         processOutput = processObject(json, options, exempleNamespace)
//         output.fields = processOutput.fields
//     }
//     if (output.type === 'array') {
//     }

//     let response = initialStructureAvro(output.fields)
//     return JSON.stringify(response, null, 4)
// }

function processObject(object, options, output, nested) {
    if (nested && output) {
        output = { fields: output }
    } else {
        output = output || {}
        output.type = getPropertyType(object, options.canBeNull)
        output.fields = output.fields || []
    }
// console.log(output)
    for (var key in object) {
        var value = object[key]
        var type = getPropertyType(value, options.canBeNull)

        type = type === 'undefined' ? 'null' : type

        // complex type record
        if (type === 'record') {
            output.fields.push({
                'name': key, 'type': processObject(value, options, output.fields[key])
            })
            // output.fields[key] = processObject(value, options, output.fields[key])
            continue
        }

        // complex type array
        if (type === 'array') {
            output.fields.push({
                'name': key, 'type': processArray(value, options, output.fields[key])
            })
            // output.fields[key] = processArray(value, options, output.fields[key])
            continue
        }

        if (output.fields[key]) {
            var entry = output.fields[key]
            var hasTypeArray = Array.isArray(entry.type)

            // When an array already exists, we check the existing
            // type array to see if it contains our current property
            // type, if not, we add it to the array and continue
            if (hasTypeArray && entry.type.indexOf(type) < 0) {
                entry.type.push(type)
            }

            // When multiple fields of differing types occur,
            // json schema states that the field must specify the
            // primitive types the field allows in array format.
            if (!hasTypeArray && entry.type !== type) {
                entry.type = [entry.type, type]
            }

            continue
        }
console.log(output)
        output.fields[key] = {}
        // output.fields[key].type = type

        if (options.canBeNull) {
            output.fields[key].default = null
        }
    }

    return nested ? output.fields : output
}

function processArray(array, options, output, nested) {
    var format
    var oneOf
    var type

    if (nested && output) {
        output = { items: output }
    } else {
        output = output || {}
        output.type = getPropertyType(array, options.canBeNull)
        output.items = output.items || {}
        type = output.items.type || null
    }

    // Determine whether each item is different
    for (var arrIndex = 0, arrLength = array.length; arrIndex < arrLength; arrIndex++) {
        var elementType = getPropertyType(array[arrIndex], options.canBeNull)
        var elementFormat = getPropertyFormat(array[arrIndex])

        if (type && elementType !== type) {
            output.items.oneOf = []
            oneOf = true
            break
        } else {
            type = elementType
            format = elementFormat
        }
    }

    // Setup type otherwise
    if (!oneOf && type) {
        output.items.type = type
        if (format) {
            output.items.format = format
        }
    } else if (oneOf && type !== 'object') {
        output.items = {
            oneOf: [{ type: type }],
            required: output.items.required
        }
    }

    // Process each item depending
    if (typeof output.items.oneOf !== 'undefined' || type === 'object') {
        for (var itemIndex = 0, itemLength = array.length; itemIndex < itemLength; itemIndex++) {
            var value = array[itemIndex]
            var itemType = getPropertyType(value, options.canBeNull)
            var itemFormat = getPropertyFormat(value)
            var arrayItem
            if (itemType === 'object') {
                if (output.items.properties) {
                    output.items.required = getUniqueKeys(output.items.properties, value, output.items.required)
                }
                arrayItem = processObject(value, options, oneOf ? {} : output.items.properties, true)
            } else if (itemType === 'array') {
                arrayItem = processArray(value, options, oneOf ? {} : output.items.properties, true)
            } else {
                arrayItem = {}
                arrayItem.type = itemType
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

function getUniqueKeys(a, b, c) {
    a = Object.keys(a)
    b = Object.keys(b)
    c = c || []

    var value
    var cIndex
    var aIndex

    for (var keyIndex = 0, keyLength = b.length; keyIndex < keyLength; keyIndex++) {
        value = b[keyIndex]
        aIndex = a.indexOf(value)
        cIndex = c.indexOf(value)

        if (aIndex === -1) {
            if (cIndex !== -1) {
                // Value is optional, it doesn't exist in A but exists in B(n)
                c.splice(cIndex, 1)
            }
        } else if (cIndex === -1) {
            // Value is required, it exists in both B and A, and is not yet present in C
            c.push(value)
        }
    }

    return c
}

// function getPropertyType(value) {
//     var type = Type.string(value).toLowerCase()

//     if (type === 'number') return Number.isInteger(value) ? 'integer' : type
//     if (type === 'date') return 'string'
//     if (type === 'regexp') return 'string'
//     if (type === 'function') return 'string'

//     return type
// }

function getPropertyFormat(value) {
    var type = Type.string(value).toLowerCase()

    if (type === 'date') return 'date-time'

    return null
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

function returnTypeNull(type, canBeNull) {
    if (type == 'null') {
        return canBeNull === true ? [type] : type
    } else {
        return canBeNull === true ? ['null', type] : type
    }
};

function getPropertyType(value, canBeNull) {
    // Verifica o tipo do value
    var type = Type.string(value).toLowerCase()


    switch (type) {
        case 'null':
            type = returnTypeNull('null', canBeNull)
            break;
        case 'boolean':
            type = returnTypeNull('boolean', canBeNull)
            break;
        case 'number':
            type = returnTypeNull(numberType(value), canBeNull)
            break;
        case 'object':
            type = returnTypeNull('record', canBeNull)
            break;
        case 'array':
            type = returnTypeNull('array', canBeNull)
            break;
        case 'string':
            type = returnTypeNull('string', canBeNull)
            break;
    }
    // Se tipo for indefinido, retorna null, senão retorna o tipo do value
    return type === 'undefined' ? ['null'] : type
}

function toPascalCase(str) {
    // Remover espaços em branco e caracteres especiais
    str = str.replace(/[^a-zA-Z0-9 ]/g, '');
    // Converter para minúsculas e dividir em palavras
    let words = str.toLowerCase().split(/\s+/);
    // Capitalizar a primeira letra de cada palavra
    let pascalCase = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    return pascalCase;
}

module.exports = function convert(json, options) {
    let object = JSON.parse(json)
    let namespace = toPascalCase(options.title)
    var processOutput
    var output = {
        'name': namespace,
        'namespace': exempleNamespace + namespace,
        'doc': 'Here you can give more details about the use of this schema'
    }

    console.log(getPropertyType(object))
    // Set initial object type
    output.type = getPropertyType(object)

    // Process object
    if (output.type === 'record') {
        processOutput = processObject(object, options)
        output.type = processOutput.type
        output.fields = processOutput.fields
    }

    if (output.type === 'array') {
        processOutput = processArray(object, options)
        output.type = processOutput.type
        output.items = processOutput.items
    }

    // Output
    return JSON.stringify(output, null, 4)
}