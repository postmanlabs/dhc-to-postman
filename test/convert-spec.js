var expect = require('expect.js'),
    converter = require('../index.js'),
    fs = require('fs');

/* global describe, it */
describe('the converter', function () {
    it('must convert a basic dhc file', function () {
        var dhcJson = fs.readFileSync('test/dhc.json').toString();
        
        converter.convert(dhcJson,function(err,convertedJSON){
            expect(convertedJSON.collection).to.be.ok();
            expect(convertedJSON.collection.item.length).to.be(4);
            //expect(convertedJSON.collection.order.length).to.be(4);  
        });
    });
});