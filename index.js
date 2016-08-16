var _ = require('lodash'),
	uuid = require('node-uuid');

var pawConverter = {
	requestGroups: [],
	folderGroups: [],
	headerGroups: [],
	zidRidMap: {},
	collection: {},
	methodsWithBody: ['POST', 'PUT', 'PATCH', 'DELETE', 'LINK', 'UNLINK', 'LOCK', 'PROPFIND', 'VIEW', 'OPTIONS'],

	createCollection: function (name) {
		return {
			id: uuid.v4(),
			name: name,
			description: 'New collection (imported from DHC)',
			order: [],
			folders: [],
			requests: [],
			timestamp: (new Date()).getTime()
		};
	},

	addRequestToCollection: function (request, collection) {
		if(collection.order.indexOf(request.id) === -1) {
			collection.order.push(request.id);
		}
		if(!_.find(collection.requests, function (cr) {cr.id === request.id;})) {
			request.collectionId = collection.id;
			collection.requests.push(request);
		}
	},

	convertToPmRequest: function (dhcRequest) {
		var request = {
			id: dhcRequest.id.toLowerCase(),
			name: dhcRequest.name,			
			description: '',
			folder: null,
			pathVariables: {},
			url: dhcRequest.uri.scheme.name + '://' + dhcRequest.uri.path,
			method: dhcRequest.method.name,
			headers: '',
			preRequestScript: null,
			tests: null,
			currentHelper: 'normal',
			data: null,
			dataMode: 'params',
			rawModeData: null
		};

		_.each(dhcRequest.headers, function (dhcHeader) {
			var str = (dhcHeader.enabled === false) ? '//' : '';
			str += dhcHeader.name + ': ' + dhcHeader.value + '\n';
			request.headers += str;
		});


		if(this.methodsWithBody.indexOf(request.method.toUpperCase()) > -1) {
			var dhcBody = dhcRequest.body;
			if(dhcBody.bodyType === 'Form' && dhcBody.formBody && dhcBody.formBody.encoding === 'multipart/form-data') {
				// multipart
				request.dataMode = 'params';
				request.data = [];
				_.each(dhcBody.formBody.items, function (item) {
					if(item.type === 'Text') {
						request.data.push({
							key: item.name,
							value: item.value,
							type: 'text',
							enabled: item.enabled
						});
					}
				});
			}
			else if(dhcBody.bodyType === 'Form' && dhcBody.formBody && 
				dhcBody.formBody.encoding === 'application/x-www-form-urlencoded') {
				// urlencoded
				request.dataMode = 'urlencoded';
				request.data = [];
				_.each(dhcBody.formBody.items, function (item) {
					if(item.type === 'Text') {
						request.data.push({
							key: item.name,
							value: item.value,
							type: 'text',
							enabled: item.enabled
						});
					}
				});
			}
			else if(dhcBody.bodyType === 'Text' && dhcBody.textBody) {
				// raw
				request.dataMode = 'raw';
				request.rawModeData = dhcBody.textBody;
			}
		}
		return request;
	},

	convertDhcProject: function (obj) {
		var rootNode = _.find(obj.nodes, function (node) {
				return node.type === 'Project';
			}),
			collection = this.createCollection(rootNode.name),
			dhcRequests = _.filter(obj.nodes, function (node) {
				return node.type === 'Request';
			}),
			oldThis = this;

		_.each(dhcRequests, function (dhcRequest) {
			var pmRequest = oldThis.convertToPmRequest(dhcRequest);
			oldThis.addRequestToCollection(pmRequest, collection);
		});
		return collection;
	},

	convert: function (dhcJson) {
		if(typeof dhcJson === 'string') {
			dhcJson = JSON.parse(dhcJson);
		}
		var collection = this.convertDhcProject(dhcJson);
		return collection;
	},
};

module.exports = pawConverter;