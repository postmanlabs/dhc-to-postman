var expect = require('expect.js'),
    converter = require('../index.js'),
    fs = require('fs');

/* global describe, it */
describe('the converter', function () {
    it('must convert a basic dhc file', function () {
        var dhcJson = fs.readFileSync('test/dhc.json').toString(),
        	convertedJSON = converter.convert(dhcJson);
        expect(convertedJSON).to.be.ok();
        expect(convertedJSON.requests.length).to.be(4);
        expect(convertedJSON.order.length).to.be(4);
    });
});