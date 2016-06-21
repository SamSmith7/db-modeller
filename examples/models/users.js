var db = require('../../db');

var config = {
	table: {
		name: 'Users',
		fields: {
			ID: { type: 'Int'},
			Name: { type: 'NVarChar', length: 50},
			Password: { type: 'VarChar', length: 'MAX'}
		}
	},
	primaryKey: 'ID'
}

module.exports = new db(config);
