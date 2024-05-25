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

function processObject(object, options, parentPath, output, nested) {
    if (nested && output) {
        output = { fields: output }
    } else {
        output = output || {}
        output.name = parentPath
        output.type = getPropertyType(object)
        output.fields = output.fields || []
    }
    for (var key in object) {
        var value = object[key]
        var type = getPropertyType(value)
        
        type = type === 'undefined' ? 'null' : type

        let entry = output.fields.find(function (object) {
            return object.name === key;
        })
        if (entry) {
            // var entry = output.fields[key]
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
            if (!hasTypeArray && entry.type !== type && type !== 'record' && type !== 'array') {
                entry.type = [entry.type, type]
            }

            continue
        }

        // complex type record
        if (type === 'record') {
            parentPath = key
            let recordObject = {
                'name': key, 'type': type
            }
            if (options.canBeNull) {
                recordObject.type = returnTypeNull(processObject(value, options, parentPath, output.fields[key]))
                recordObject = { ...recordObject, ...{ 'default': null } }
            }
            output.fields.push(recordObject)
            
            continue
        }

        // complex type array
        if (type === 'array') {
            parentPath = key 
            let recordObject = {
                'name': key, 'type': type, 'items': processArray(value, options, parentPath, output.fields[key]).items
            }
            if (options.canBeNull) {
                recordObject.type = returnTypeNull(type)
                recordObject = { ...recordObject, ...{ 'default': null } }
            }
            output.fields.push(recordObject)

            continue
        }

        // primitive type
        let recordObject = {
            'name': key, 'type': type
        }
        if (options.canBeNull) {
            recordObject.type = returnTypeNull(type)
            recordObject = { ...recordObject, ...{ 'default': null } }
        }
        output.fields.push(recordObject)
    }

    return nested ? output.fields : output
}

function processArray(array, options, parentPath, output, nested) {
    var format
    var oneOf
    var type

    if (nested && output) {
        output = { items: output }
    } else {
        output = output || {}
        output.items = output.items || {}
        output.items.name = output.items.name || parentPath
        output.items.type = output.items.type || ''
        output.items.fields = output.items.fields || []
        type = output.items.type || null
    }

    // Determine whether each item is different
    for (var arrIndex = 0, arrLength = array.length; arrIndex < arrLength; arrIndex++) {
        var elementType = getPropertyType(array[arrIndex])

        if (type && elementType !== type) {
            output.items.fields[arrIndex].oneOf = []
            oneOf = true
            break
        } else {
            type = elementType
        }
    }

    // Setup type otherwise
    if (!oneOf && type) {
        output.items.type = type
    } else if (oneOf && type !== 'record') {
        output.items.fields.push({
            type: [type],
        })
    }

    // Process each item depending
    if (typeof output.items.oneOf !== 'undefined' || type === 'record') {
        for (var itemIndex = 0, itemLength = array.length; itemIndex < itemLength; itemIndex++) {
            var value = array[itemIndex]
            var itemType = getPropertyType(value)
            var arrayItem = {}
            if (itemType === 'record') {
                arrayItem.fields = processObject(value, options, parentPath, oneOf ? {} : output.items.fields, true)
            } else if (itemType === 'array') {
                arrayItem.items = processArray(value, options, parentPath, oneOf ? {} : output.items.fields, true)
            } else {
                arrayItem = {}
                arrayItem.name = parentPath
                arrayItem.type = itemType
            }
            if (oneOf) {
                var childType = Type.string(value).toLowerCase()
                var tempObj = {}
                if (!arrayItem.type && childType === 'record') {
                    tempObj.fields = arrayItem
                    tempObj.type = 'record'
                    arrayItem = tempObj
                }
                output.items.oneOf.push(arrayItem)
            } else {
                if (output.items.type !== 'record') {
                    continue;
                }
                output.items.fields = arrayItem.fields
            }
        }
    }
    if (type !== 'record' && type !== 'array') {
        output.items = type
        if (options.canBeNull) {
            output.items = returnTypeNull(type)
        }
    }

    return nested ? output.items.fields : output
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

function returnTypeNull(type) {
    if (type == 'null') {
        return [type]
    } else {
        return ['null', type]
    }
};

function getPropertyType(value) {
    // Verifica o tipo do value
    var type = Type.string(value).toLowerCase()


    switch (type) {
        case 'null':
            type = 'null'
            break;
        case 'boolean':
            type = 'boolean'
            break;
        case 'number':
            type = numberType(value)
            break;
        case 'object':
            type = 'record'
            break;
        case 'array':
            type = 'array'
            break;
        case 'string':
            type = 'string'
            break;
    }
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

    // Set initial object type
    output.type = getPropertyType(object)

    // Process object
    if (output.type === 'record') {
        processOutput = processObject(object, options, "")
        output.type = processOutput.type
        output.fields = processOutput.fields
    }

    if (output.type === 'array') {
        processOutput = processArray(object, options, "")
        output.type = processOutput.type
        output.items = processOutput.items
    }

    // Output
    return JSON.stringify(output, null, 4)
}