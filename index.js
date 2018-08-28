var _ = require('lodash'),
  fs = require('fs'),
  default_name = 'Converted From ' + require('./package.json').com_postman_plugin.source_format_name,
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
    createCollection: function(project) {
      return {
        info: {
          name: project.node.name,
          description: '',
          schema:
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: project.item
      };
    },

    convertToPmFolder: function(dhcFolder) {
      var folder = {
        name: dhcFolder.node.name,
        description: '',
        item: dhcFolder.item
      };

      return folder;
    },

    convertToPmUrl: function(uri) {
      var pmUrl = {
          raw: '',
          query: [],
          variables: []
        },
        str = uri.scheme.name + '://' + (uri.host ? uri.host : '') +
          (uri.path.substring(0, 1) === '/' ? '' : '/') + (uri.path ? uri.path : '');

      if (uri.hasOwnProperty('query')) {
        if (uri.query.items.length !== 0) {
          str += '?';
          _.each(uri.query.items, function(param) {
            var obj = {};

            obj.key = param.name;
            obj.value = param.value;
            if (param.hasOwnProperty('enabled') && param.enabled === false) {
              obj.disabled = true;
            }
            else {
              str = str + obj.key + '=' + obj.value + '&';
            }
            pmUrl.query.push(obj);
          });
          str = str.slice(0, -1);
          pmUrl.raw = str;
        }
      }

      return pmUrl;
    },
    convertToPmHeaders: function(headers) {
      var pmHeader = [];

      _.each(headers, function(dhcHeader) {
        var header = {};

        header.key = dhcHeader.name;
        header.value = dhcHeader.value;
        if (dhcHeader.enabled === false) {
          header.disabled = true;
        }
        pmHeader.push(header);
      });

      return pmHeader;
    },
    convertToPmBody: function(dhcBody, method) {
      var pmBody = {};

      if (
        this.methodsWithBody.indexOf(method.toUpperCase()) > -1
      ) {
        if (
          dhcBody.bodyType === 'Form' &&
          dhcBody.formBody &&
          dhcBody.formBody.encoding === 'multipart/form-data'
        ) {
          // multipart
          pmBody.mode = 'Formdata';
          pmBody.formdata = [];
          _.each(dhcBody.formBody.items, function(item) {
            if (item.type === 'Text') {
              var requestdata = {};

              requestdata.key = item.name;
              requestdata.value = item.value;
              requestdata.type = 'text';
              if (!item.enabled) {
                requestdata.disabled = true;
              }
              pmBody.formdata.push(requestdata);
            }
          });
        }
        else if (
          dhcBody.bodyType === 'Form' &&
          dhcBody.formBody &&
          dhcBody.formBody.encoding === 'application/x-www-form-urlencoded'
        ) {
          // urlencoded
          pmBody.mode = 'urlencoded';
          pmBody.urlencoded = [];
          _.each(dhcBody.formBody.items, function(item) {
            if (item.type === 'Text') {
              var requestdata = {};

              requestdata.key = item.name;
              requestdata.value = item.value;
              requestdata.type = 'text';
              if (!item.enabled) {
                requestdata.disabled = true;
              }
              pmBody.urlencoded.push(requestdata);
            }
          });
        }
        else if (dhcBody.bodyType === 'Text' && dhcBody.textBody) {
          // raw
          pmBody.mode = 'raw';
          pmBody.raw = dhcBody.textBody;
        }
      }

      return pmBody;
    },

    convertToPmRequest: function(dhcRequest) {
      return {
        name: dhcRequest.name,
        request: {
          method: dhcRequest.method.name,
          header: this.convertToPmHeaders(dhcRequest.headers),
          body: this.convertToPmBody(dhcRequest.body, dhcRequest.method.name),
          url: this.convertToPmUrl(dhcRequest.uri)
        },
        response: []
      };
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
          xthis = this,
          //following are used in for-in
          id,
          parent_id,
          pmRequest,
          pmFolder,
          collection,
          dhcEnvi,
          environment,
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
        dhcJson.nodes.forEach((node) => {
          var obj = {
            node: node,
            item: []
          };

          switch (node.type) {
            case 'Project': {
              dhcProjects[node.id] = obj;
              break;
            }
            case 'Service': {
              dhcServices[node.id] = obj;
              break;
            }
            case 'Scenario': {
              dhcScenarios[node.id] = obj;
              break;
            }
            case 'Request': {
              dhcRequests[node.id] = {
                node: node
              };
              break;
            }
            case 'Context': {
              dhcEnvis[node.id] = {
                node: node
              };
              break;
            }
            default: {
              cb(null, {
                result: false,
                reason: 'type:' + node.type + ' in' + JSON.stringify(node) + 'is not valid'
              });

              return false;
            }
          }

          return true;
        });
        //adding default project to projects
        dhcProjects[default_name] = {
          node: {
            type: 'Project',
            description: '',
            name: default_name
          },
          item: []
        };
        for (id in dhcRequests) {
          if (dhcRequests.hasOwnProperty(id)) {
            parent_id = dhcRequests[id].node.parentId;
            pmRequest = xthis.convertToPmRequest(dhcRequests[id].node);
            if (parent_id) {
              if (dhcScenarios[parent_id]) {
                dhcScenarios[parent_id].item.push(pmRequest);
              }
              else if (dhcServices[parent_id]) {
                dhcServices[parent_id].item.push(pmRequest);
              }
              else if (dhcProjects[parent_id]) {
                dhcProjects[parent_id].item.push(pmRequest);
              }
              else {
                return cb(null, {
                  result: false,
                  reason: 'nodes with parentId' + parent_id + ' is not found'
                });
              }
            }
            else {
              dhcProjects[default_name].item.push(pmRequest);
            }
          }
        }
        for (id in dhcScenarios) {
          if (dhcScenarios.hasOwnProperty(id)) {
            parent_id = dhcScenarios[id].node.parentId;
            pmFolder = xthis.convertToPmFolder(dhcScenarios[id]);
            if (parent_id) {
              if (dhcServices[parent_id]) {
                dhcServices[parent_id].item.push(pmFolder);
              }
              else if (dhcProjects[parent_id]) {
                dhcProjects[parent_id].item.push(pmFolder);
              }
              else {
                return cb(null, {
                  result: false,
                  reason: 'nodes with parentId' + parent_id + ' is not found'
                });
              }
            }
            else {
              dhcProjects[default_name].item.push(pmFolder);
            }
          }
        }
        for (id in dhcServices) {
          if (dhcServices.hasOwnProperty(id)) {
            parent_id = dhcServices[id].node.parentId;
            pmFolder = xthis.convertToPmFolder(dhcServices[id]);
            if (parent_id) {
              if (dhcProjects[parent_id]) {
                dhcProjects[parent_id].item.push(pmFolder);
              }
              else {
                return cb(null, {
                  result: false,
                  reason: 'nodes with parentId' + parent_id + ' is not found'
                });
              }
            }
            else {
              dhcProjects[default_name].item.push(pmFolder);
            }
          }
        }
        for (id in dhcProjects) {
          if (dhcProjects.hasOwnProperty(id)) {
            collection = xthis.createCollection(dhcProjects[id]);
            //does not create collection for default project with empty items.
            if (collection.item.length !== 0 || id !== default_name) {
              output.push({
                type: 'collection',
                data: collection
              });
            }
          }
        }
        for (dhcEnvi in dhcEnvis) {
          if (dhcEnvis.hasOwnProperty(dhcEnvi)) {
            environment = xthis.convertTOPmEnvi(dhcEnvis[dhcEnvi].node);
            output.push({
              type: 'environment',
              data: environment
            });
          }
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
      if (!dhcJson.hasOwnProperty('version')) {
        return {
          result: false,
          reason: 'The input object must have a "version" property'
        };
      }
      if (!dhcJson.hasOwnProperty('nodes')) {
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
