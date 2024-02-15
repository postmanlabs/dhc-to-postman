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

    it('should throw UserError if data is not JSON', function () {
        try {
            var dhcJson = 'Sample String';
            converter.convert(dhcJson);
        } catch (error) {
            expect(error).to.be.ok();
            expect(error.name).to.be('UserError');
            expect(error.message).to.be('Provided data is invalid JSON');
        }
    });

    it('should throw UserError if data does not contain any requests', function () {
        try {
            var dhcJson = {
                nodes: [{
                    type: 'Project',
                    name: 'Sample Project'
                }]
            };
            converter.convert(dhcJson);
        } catch (error) {
            expect(error).to.be.ok();
            expect(error.name).to.be('UserError');
            expect(error.message).to.be('No requests found in the DHC project');
        }
    });
});