var expect = require('expect.js'),
    converter = require('../index.js'),
    fs = require('fs');

/* global describe, it */
describe('the converter', function () {
    it('must convert a basic dhc file', function () {
        var dhcJson = fs.readFileSync('test/dhc.json').toString();

        converter.convert(dhcJson, function (err, ConversionResult) {
            expect(ConversionResult.result).to.be(true);
            ConversionResult.output.forEach(function (element) {
                expect(element.type).to.be('collection' || 'request');
                if (element.type === 'collection') {
                    expect(element.data).to.be.ok();
                    expect(element.data.item.length).to.be(4);
                }
            });  
        });
    });
});