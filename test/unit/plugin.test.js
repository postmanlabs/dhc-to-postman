var path = '../../',
    expect = require('expect.js'),
    mod = require(path),
    package = require(path + '/package.json');
/* global describe, it */
describe(package.name + ' should contains', function() {
  describe('com_postman_plugin attributes', function() {
    it('plugin_type', function() {
      expect(package.com_postman_plugin).to.have.property('plugin_type');
    });
    it('name', function() {
      expect(package.com_postman_plugin).to.have.property('name');
    });
    it('source_format', function() {
      expect(package.com_postman_plugin).to.have.property('source_format');
    });
    it('sample_input', function () {
      expect(package.com_postman_plugin.hasOwnProperty('sample_input')).to.equal(true);
    });
  });
  describe('functions', function() {
    it('validate', function() {
      expect(typeof mod.validate).to.be('function');
    });
    it('convert', function() {
      expect(typeof mod.convert).to.be('function');
    });
  });
  describe('retun values of', function() {
    it('validate as expected', function() {
      expect(
        mod.validate(package.com_postman_plugin.sample_input).result
      ).to.be(true);
    });
    it('convert as expected', function() {
      mod.convert(package.com_postman_plugin.sample_input, function(
        err,
        ConversionResult
      ) {
        expect(ConversionResult.result).to.be(true);
        ConversionResult.output.forEach(function(element) {
          expect(element.type).to.be('collection' || 'request');
          if (element.type === 'collection') {
            expect(element.data).to.have.property('info');
            expect(element.data).to.have.property('item');
          }
        });
        
      });
    });
  });
});
