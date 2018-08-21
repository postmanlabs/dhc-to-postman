var _ = require('lodash'),
//  uuidv4 = require('uuid/v4');
  fs = require('fs'),
  sdk=require('postman-collection');

var dhcConverter = {
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

  addRequestToCollection: function(request, collection) {
    collection.item.push(request);
  },

  addFolderToCollection: function(folder, collection) {
    collection.item.push(folder);
    return collection.item.length - 1;
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
      response:[]
    },
      str=dhcRequest.uri.scheme.name + '://' + dhcRequest.uri.host;
    
    item.request.url=sdk.Url.parse(str);
    str=item.request.url.raw;
    item.request.url.query=[];
    //url query params
    if ('query' in dhcRequest.uri) {
      
      if (dhcRequest.uri.query.items.lenght !== 0) {
        str =str+ '?';
        _.each(dhcRequest.uri.query.items, function(param) {
          var obje = {};
          obje.key = param.name;
          obje.value = param.value;
          if (!param.enabled) {
            obje.disabled = true;
          } else {
            str = str + obje.key + '=' + obje.value + '&';
          }
           item.request.url.query.push(obje);
        });
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

    if (this.methodsWithBody.indexOf(item.request.method.toUpperCase()) > -1) {
      var dhcBody = dhcRequest.body;
      var request = item.request.body; //here request refers to body.
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
      } else if (
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
      } else if (dhcBody.bodyType === 'Text' && dhcBody.textBody) {
        // raw
        request.mode = 'raw';
        request.raw = dhcBody.textBody;
      }
    }
    return item;
  },

  convertDhcProject: function(obj) {
    var rootNode = _.find(obj.nodes, function(node) {
        return node.type === 'Project';
      }),
      collection = this.createCollection(rootNode.name),
      dhcServices = _.filter(obj.nodes, function(node) {
        return node.type === 'Service';
      }),
      dhcScenarios = _.filter(obj.nodes, function(node) {
        return node.type === 'Scenario';
      }),
      dhcRequests = _.filter(obj.nodes, function(node) {
        return node.type === 'Request';
      }),
      oldThis = this;
    //services
    _.each(dhcServices, function(dhcService) {
      if (dhcService.parentId === rootNode.id) {
        var pmFolder = oldThis.convertToPmFolder(dhcService);
        var serviceIndex = oldThis.addFolderToCollection(pmFolder, collection);
        //services -> scenarios
        _.each(dhcScenarios, function(dhcScenario) {
          if (dhcScenario.parentId === dhcService.id) {
            var pmScenario = oldThis.convertToPmFolder(dhcScenario);
            var scenarioIndex = oldThis.addFolderToCollection(
              pmScenario,
              collection.item[serviceIndex]
            );
            //services -> scenarios -> request
            _.each(dhcRequests, function(dhcRequest) {
              if (dhcRequest.parentId === dhcScenario.id) {
                var pmRequest = oldThis.convertToPmRequest(dhcRequest);
                oldThis.addRequestToCollection(
                  pmRequest,
                  collection.item[serviceIndex].item[scenarioIndex]
                );
              }
            });
          }
        });
        //services -> request
        _.each(dhcRequests, function(dhcRequest) {
          if (dhcRequest.parentId === dhcService.id) {
            var pmRequest = oldThis.convertToPmRequest(dhcRequest);
            oldThis.addRequestToCollection(
              pmRequest,
              collection.item[serviceIndex]
            );
          }
        });
      }
    });

    //scenarios
    _.each(dhcScenarios, function(dhcScenario) {
      if (dhcScenario.parentId === rootNode.id) {
        var pmScenario = oldThis.convertToPmFolder(dhcScenario);
        var scenarioIndex = oldThis.addFolderToCollection(
          pmScenario,
          collection
        );
        //scenarios -> request
        _.each(dhcRequests, function(dhcRequest) {
          if (dhcRequest.parentId === dhcScenario.id) {
            var pmRequest = oldThis.convertToPmRequest(dhcRequest);

            oldThis.addRequestToCollection(
              pmRequest,
              collection.item[scenarioIndex]
            );
          }
        });
      }
    });

    //request
    _.each(dhcRequests, function(dhcRequest) {
      if (dhcRequest.parentId === rootNode.id) {
        var pmRequest = oldThis.convertToPmRequest(dhcRequest);
        oldThis.addRequestToCollection(pmRequest, collection);
      }
    });
    return collection;
  },

  convert: function(dhcJson) {
    var collection = this.convertDhcProject(dhcJson);
    return collection;
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
  validate:function(input){
    try{
      var data;
    if(input.type === 'string'){
      data=JSON.parse(input.data);
      return dhcConverter.validate(data);
    }
    else if(input.type === 'json'){
      data=input.data;
      return dhcConverter.validate(data);
    }
    else if(input.type === 'file'){
      data=fs.readFileSync(input.data).toString();
      data=JSON.parse(data);
      return dhcConverter.validate(data);
    }
    else{
      throw 'input type is not valid';
    }
    }
    catch(e){
      return {
        result:false,
        reason:e.toString()
      };
    }
    

  } ,
  convert: function(input,options, cb) {
    var data;
    try{
    if(input.type === 'string'){
      data=JSON.parse(input.data);
    }
    else if(input.type === 'json'){
      data=input.data;
    }
    else if(input.type === 'file'){
      data=fs.readFileSync(input.data).toString();
      data=JSON.parse(data);
    }
    else{
      throw 'input type is not valid';
    }
    var conversionResult = dhcConverter.convert(data);
      cb(null, {
        result: true,
        output: [
          {
            type: 'collection',
            data: conversionResult
          }
        ]
      });
    }
   catch (e) {
      console.log(e);
      cb(null, {
        result: false,
        reason: e.toString()
      });
    }
  }
};
