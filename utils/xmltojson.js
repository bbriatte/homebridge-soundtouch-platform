const parser = require('xml2json');

const options = {
    object: false,
    reversible: false,
    coerce: false,
    sanitize: true,
    trim: true,
    arrayNotation: false
};

module.exports = {

    convert: function (xml) {
        return JSON.parse(parser.toJson(xml, options));
    },

    convertResponse: function(response, handler) {
        let output = "";

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function() {
            handler(JSON.parse(parser.toJson(output)))
        });
    }
};
