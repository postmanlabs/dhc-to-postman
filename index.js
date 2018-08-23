var _ = require('lodash'),
  //  uuidv4 = require('uuid/v4');
  fs = require('fs'),
  sdk = require('postman-collection'),
  default_name = require('./package.json').com_postman_plugin.source_format_name,
  dhcConverter = {
    collection: {},
    methodsWithBody: [
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'LINK',
      'UNLINK',
      'LOCK',
      'PROPFIND',
      'VIEW',
      'OPTIONS'
    ],
    createCollection: function(name) {
      return {
        info: {
          name: name,
          description: '',
          schema:
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: []
      };
    },

    convertToPmFolder: function(dhcFolder) {
      var folder = {
        name: dhcFolder.name,
        description: '',
        item: []
      };

      return folder;
    },

    convertToPmRequest: function(dhcRequest) {
      var item = {
          //_postman_id: dhcRequest.id.toLowerCase(),
          name: dhcRequest.name,
          request: {
            method: dhcRequest.method.name,
            header: [],
            body: {},
            url: {}
          },
          response: []
        },
        dhcBody,
        request,
        str = dhcRequest.uri.scheme.name + '://' + (dhcRequest.uri.host ? dhcRequest.uri.host : '') +
        (dhcRequest.uri.path.substring(0, 1) === '/' ? '' : '/') + (dhcRequest.uri.path ? dhcRequest.uri.path : '');

      item.request.url = sdk.Url.parse(str);
      str = item.request.url.raw;
      item.request.url.query = [];
      //url query params
      if ('query' in dhcRequest.uri) {
        if (dhcRequest.uri.query.items.length !== 0) {
          str += '?';
          _.each(dhcRequest.uri.query.items, function(param) {
            var obj = {};

            obj.key = param.name;
            obj.value = param.value;
            if (param.hasOwnProperty('enabled') && param.enabled === false) {
              obj.disabled = true;
            }
            else {
              str = str + obj.key + '=' + obj.value + '&';
            }
            item.request.url.query.push(obj);
          });
          str = str.slice(0, -1);
        }
        item.request.url.raw = str;
      }

      _.each(dhcRequest.headers, function(dhcHeader) {
        var header = {};

        header.key = dhcHeader.name;
        header.value = dhcHeader.value;
        if (dhcHeader.enabled === false) {
          header.disabled = true;
        }
        item.request.header.push(header);
      });

      if (
        this.methodsWithBody.indexOf(item.request.method.toUpperCase()) > -1
      ) {
        dhcBody = dhcRequest.body;
        request = item.request.body; //here request refers to body.

        if (
          dhcBody.bodyType === 'Form' &&
          dhcBody.formBody &&
          dhcBody.formBody.encoding === 'multipart/form-data'
        ) {
          // multipart
          request.mode = 'Formdata';
          request.formdata = [];
          _.each(dhcBody.formBody.items, function(item) {
            if (item.type === 'Text') {
              var requestdata = {};

              requestdata.key = item.name;
              requestdata.value = item.value;
              requestdata.type = 'text';
              if (!item.enabled) {
                requestdata.disabled = true;
              }
              request.formdata.push(requestdata);
            }
          });
        }
        else if (
          dhcBody.bodyType === 'Form' &&
          dhcBody.formBody &&
          dhcBody.formBody.encoding === 'application/x-www-form-urlencoded'
        ) {
          // urlencoded
          request.mode = 'urlencoded';
          request.urlencoded = [];
          _.each(dhcBody.formBody.items, function(item) {
            if (item.type === 'Text') {
              var requestdata = {};

              requestdata.key = item.name;
              requestdata.value = item.value;
              requestdata.type = 'text';
              if (!item.enabled) {
                requestdata.disabled = true;
              }
              request.urlencoded.push(requestdata);
            }
          });
        }
        else if (dhcBody.bodyType === 'Text' && dhcBody.textBody) {
          // raw
          request.mode = 'raw';
          request.raw = dhcBody.textBody;
        }
      }

      return item;
    },
    convertTOPmEnvi: function(dhcEnvi) {
      var pmEnvi = {
        name: dhcEnvi.name,
        values: []
      };

      dhcEnvi.variables.forEach(function(element) {
        pmEnvi.values.push({
          enabled: element.enabled,
          key: element.name,
          value: element.value,
          type: 'text'
        });
      });

      return pmEnvi;
    },

    convert: function(dhcjson, cb) {
      try {
        var dhcJson = dhcjson,
          dhcProjects = {},
          dhcServices = {},
          dhcScenarios = {},
          dhcRequests = {},
          dhcEnvis = {},
          output = [],
          prethis = this,
          dhcRequest, //used in for-in
          dhcScenario,
          dhcService,
          dhcProject,
          id,
          pmRequest,
          collection,
          dhcEnvi,
          environment,
          pmFolder,
          str,
          arr = [];

        str = JSON.stringify(dhcjson);
        //conversion from ${name} to {{name}}
        arr = str.match(/\${.*?}/g);
        if (arr) {
          arr.forEach(function(element) {
            str = str.replace(element, '{' + element.substring(1, element.length) + '}');
          });
        }
        dhcJson = JSON.parse(str);
        dhcJson.nodes.forEach(function(node) {
          switch (node.type) {
            case 'Project': {
              dhcProjects[node.id] = {};
              dhcProjects[node.id].node = node;
              dhcProjects[node.id].item = [];
              break;
            }
            case 'Service': {
              dhcServices[node.id] = {};
              dhcServices[node.id].node = node;
              dhcServices[node.id].item = [];
              break;
            }
            case 'Scenario': {
              dhcScenarios[node.id] = {};
              dhcScenarios[node.id].node = node;
              dhcScenarios[node.id].item = [];
              break;
            }
            case 'Request': {
              dhcRequests[node.id] = {};
              dhcRequests[node.id].node = node;
              break;
            }
            case 'Context': {
              dhcEnvis[node.id] = {};
              dhcEnvis[node.id].node = node;
              break;
            }
            default: {
              return {
                result: false,
                reason: node.type + 'in' + JSON.stringify(node) + 'is not valid'
              };
            }
          }
        });
        dhcProjects[default_name] = {};
        dhcProjects[default_name].node = {
          type: 'Project',
          description: '',
          name: default_name
        };
        dhcProjects[default_name].item = [];
        for (dhcRequest in dhcRequests) {
          if (dhcRequests[dhcRequest]) {
            id = dhcRequests[dhcRequest].node.parentId;
            pmRequest = prethis.convertToPmRequest(dhcRequests[dhcRequest].node);
            if (id) {
              if (dhcScenarios[id]) {
                dhcScenarios[id].item.push(pmRequest);
                delete dhcRequests[dhcRequest];
              }
              else if (dhcServices[id]) {
                dhcServices[id].item.push(pmRequest);
                delete dhcRequests[dhcRequest];
              }
              else if (dhcProjects[id]) {
                dhcProjects[id].item.push(pmRequest);
                delete dhcRequests[dhcRequest];
              }
            }
            else {
              dhcProjects[default_name].item.push(pmRequest);
              delete dhcRequests[dhcRequest];
            }
          }
        }
        for (dhcScenario in dhcScenarios) {
          id = dhcScenarios[dhcScenario].node.parentId;
          pmFolder = prethis.convertToPmFolder(dhcScenarios[dhcScenario].node);
          pmFolder.item = dhcScenarios[dhcScenario].item;
          if (id) {
            if (dhcServices[id]) {
              dhcServices[id].item.push(pmFolder);
              delete dhcScenarios[dhcScenario];
            }
            else if (dhcProjects[id]) {
              dhcProjects[id].item.push(pmFolder);
              delete dhcScenarios[dhcScenario];
            }
          }
          else {
            dhcProjects[default_name].item.push(pmFolder);
            delete dhcScenarios[dhcScenario];
          }
        }
        for (dhcService in dhcServices) {
          id = dhcServices[dhcService].node.parentId;
          pmFolder = prethis.convertToPmFolder(dhcServices[dhcService].node);
          pmFolder.item = dhcServices[dhcService].item;
          if (id) {
            if (dhcProjects[id]) {
              dhcProjects[id].item.push(pmFolder);
              delete dhcServices[dhcService];
            }
          }
          else {
            dhcProjects[default_name].item.push(pmFolder);
            delete dhcServices[dhcService];
          }
        }
        for (dhcProject in dhcProjects) {
          collection = prethis.createCollection(
            dhcProjects[dhcProject].node.name
          );
          collection.item = dhcProjects[dhcProject].item;
          //does not create collection for default project with empty items.
          if (collection.item.length !== 0 || dhcProject !== default_name) {
            output.push({
              type: 'collection',
              data: collection
            });
          }
        }
        for (dhcEnvi in dhcEnvis) {
          environment = prethis.convertTOPmEnvi(dhcEnvis[dhcEnvi].node);
          output.push({
            type: 'environment',
            data: environment
          });
        }

        return cb(null, {
          result: true,
          output: output
        });
      }
      catch (e) {
        return cb(e);
      }
    },
    validate: function(dhcJson) {
      if (!dhcJson.version) {
        return {
          result: false,
          reason: 'The input object must have a "version" property'
        };
      }
      if (!dhcJson.nodes) {
        return {
          result: false,
          reason: 'The input object must have a "nodes" property'
        };
      }

      return {
        result: true
      };
    }
  };

module.exports = {
  validate: function(input) {
    try {
      var data;

      if (input.type === 'string') {
        data = JSON.parse(input.data);

        return dhcConverter.validate(data);
      }
      else if (input.type === 'json') {
        data = input.data;

        return dhcConverter.validate(data);
      }
      else if (input.type === 'file') {
        data = fs.readFileSync(input.data).toString();
        data = JSON.parse(data);

        return dhcConverter.validate(data);
      }

      return {
        result: false,
        reason: 'input type is not valid'
      };
    }
    catch (e) {
      return {
        result: false,
        reason: e.toString()
      };
    }
  },
  convert: function(input, options, cb) {
    try {
      if (input.type === 'string') {
        return dhcConverter.convert(JSON.parse(input.data), cb);
      }
      else if (input.type === 'json') {
        return dhcConverter.convert(input.data, cb);
      }
      else if (input.type === 'file') {
        return fs.readFile(input.data, function(err, data) {
          if (err) {
            return cb(err);
          }

          return dhcConverter.convert(JSON.parse(data.toString()), cb);
        });
      }

      return cb(null, {
        result: false,
        reason: 'input type is not valid'
      });
    }
    catch (e) {
      return cb(e);
    }
  }
};
