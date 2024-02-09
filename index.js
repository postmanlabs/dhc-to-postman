/*jshint esversion: 6 */

var _ = require('lodash'),
	{ v4: uuidv4 } = require('uuid'),
	UserError = require('./UserError');

var dhcConverter = {
	requestGroups: [],
	folderGroups: [],
	headerGroups: [],
	zidRidMap: {},
	collection: {},
	methodsWithBody: ['POST', 'PUT', 'PATCH', 'DELETE', 'LINK', 'UNLINK', 'LOCK', 'PROPFIND', 'VIEW', 'OPTIONS'],

	createCollection: function (name) {
		return {
			id: uuidv4(),
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
			collection,
			dhcRequests,
			oldThis = this;

		collection = this.createCollection(_.get(rootNode, 'name', 'DHC Import'));
		dhcRequests = _.filter(obj.nodes, function (node) {
			return node.type === 'Request';
		});

		if (dhcRequests.length === 0) {
			throw new UserError('No requests found in the DHC project');
		}

		_.each(dhcRequests, function (dhcRequest) {
			try {
				var pmRequest = oldThis.convertToPmRequest(dhcRequest);
				oldThis.addRequestToCollection(pmRequest, collection);
			} catch (e) {
				// ignore individual request errors if any and continue with other requests
			}
		});
		return collection;
	},

	convert: function (dhcJson) {
		try {
			if(typeof dhcJson === 'string') {
				dhcJson = JSON.parse(dhcJson);
			}
		}
		catch (error) {
			throw new UserError('Provided data is invalid JSON');	
		}

		var collection = this.convertDhcProject(dhcJson);
		return collection;
	},
};

module.exports = dhcConverter;