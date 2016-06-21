"use strict";
var sql = require('mssql');

class DB {

	// Perform a select statement onto the database
	get(search) {
		var self = this;

		if (search === undefined) { search = {} }

		return new Promise(function(resolve, reject) {
			// Set the fields to be returned from the database
			var returnValue = self._returnValues(search);
			// Set the field(s) to filter the results by
			var filter = self._filters(search);
			// Set the manipulators
			var manipulator = self._manipulators(search);
			// Handle Chaining Functions
			var query = {
				string: "SELECT " + returnValue + ' FROM ' + self._tableName.aliased + ' ' + (!filter ? '' : filter.string) + (!manipulator ? '' : manipulator),
				values: filter.values
			}
			//console.log(self._queries);
			//console.log(query);

			// Run the query
			self._runQuery(query).then(function(result) {
				resolve(result);
			}, function(err) {
				reject(err);
			});
		});
	}

	// Function to retrieve a single record from a table
	getOne(value) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var search = { filters: value };

			self.get(search).then(function(result) {
				resolve(result[0]);
			}, function(err) {
				console.log(err);
				reject(err);
			});
		});
	}

	// Function to retrieve a many records from a table that match the criteria
	getMany(value) {
		var self = this;

		return new Promise(function(resolve, reject) {
			var search = { filters: value };

			self.get(search).then(function(result) {
				resolve(result);
			}, function(err) {
				console.log(err);
				reject(err);
			});
		});
	}


	update(newRecords) {

		var self = this;

		return new Promise(function(resolve, reject) {

			// Put single record into an array
			if (!Array.isArray(newRecords)) {
				newRecords = [newRecords];
			}

			// Generate the queries required to update
			var query = [];
			for (var record in newRecords) {
				var queries = self._updateRecord(newRecords[record]);
				for (var i in queries) {
					var tmp = JSON.parse(JSON.stringify(queries[i]));
					query.push(tmp);
				}
			}

			//console.log(query);

			// Send the array of queries to the run query function
			self._runQuery(query).then(function(result) {
				resolve(result);
			}, function(err) {
				reject(err);
			});

		});
	}

	create(newRecords) {

		var self = this;

		return new Promise(function(resolve, reject) {

			// Put single record into an array
			if (!Array.isArray(newRecords)) {
				newRecords = [newRecords];
			}

			// Generate the queries required to update
			var query = [];
			for (var record in newRecords) {
				var queries = self._createRecord(newRecords[record]);
				for (var i in queries) {
					var tmp = JSON.parse(JSON.stringify(queries[i]));
					query.push(tmp);
				}
			}

			//console.log(query);

			// Send the array of queries to the run query function
			self._runQuery(query).then(function(result) {
				resolve(result);
			}, function(err) {
				reject(err);
			});

		});
	}

	// Delete Method for removing records from the database
	delete(values) {

		var self = this;

		// Put single record into an array
		if (!Array.isArray(values)) {
			values = [values];
		}

		return new Promise(function(resolve, reject) {
			var query = [];
			for (var value in values) {
				var queries = self._deleteRecord(values[value]);
				for (var i in queries) {
					var tmp = JSON.parse(JSON.stringify(queries[i]));
					query.push(tmp);
				}
			}

			// Run the query
			self._runQuery(query).then(function(result) {
				resolve(result);
			}, function(err) {
				reject(err);
			});
		});
	}

	// Internal Private Functions

	constructor(dbConfig) {

		// Database Connection Info
		this._connection = {
			server: "localhost\\SQLEXPRESS",
			database: "i-facts",
			user: "sa",
			password: "!sa123",
			port: 1433
		}

		///// INIT VARIABLES /////
		this._queries = false;
		this._fields = { a: dbConfig.table.fields };
		this._name = { a: dbConfig.table.name };
		this._linkID = { a: dbConfig.primaryKey };
		this._primaryKey = { a: dbConfig.primaryKey };
		this._multipleTables = false;
		this._tableName = {
			aliased: null,
			seperate: { a: dbConfig.table.name }
		};

		if ('linkTables' in dbConfig) {
			this._multipleTables = true;

			// Set Table Name
			var tableName = '"' + dbConfig.table.name + '" a';
			var alias = 'b';
			// Set up variables for link tables
			for (var key in dbConfig.linkTables) {

				var linkTable = dbConfig.linkTables[key];
				if(!Array.isArray(linkTable.linkID)) { linkTable.linkID = [linkTable.linkID] }

				// Set linkID object
				this._linkID[alias] = linkTable.linkID[0];

				// Set primaryKey object
				this._primaryKey[alias] = linkTable.primaryKey;

				// Set fields object
				this._fields[alias] = linkTable.fields;

				// Set seperate tableName
				this._tableName.seperate[alias] = key;

				// Add aliased table name to the tableName variable
				var join = 'joinType' in linkTable ? linkTable.joinType : 'INNER';
				var name = 'name' in linkTable ? linkTable.name : key;
				tableName += ' ' + join + ' JOIN "' + name + '" ' + alias + ' ON ';


				for (var i in linkTable.linkID ) {
					tableName += this._fieldValid(linkTable.linkID[i].label) + '."' + linkTable.linkID[i].dbName + '"=' + alias + '."';
					tableName += ('linkOn' in linkTable.linkID[i] ? linkTable.linkID[i].linkOn : linkTable.primaryKey) + '" ';
					tableName += ('linkType' in linkTable ? linkTable.linkType : 'AND') + ' ';
				}
				tableName = 'linkType' in linkTable ? tableName.slice(0, -3) : tableName.slice(0, -4);

				// Increment alias
				alias = String.fromCharCode(alias.charCodeAt(0) + 1);
			}
			// Set aliased tableName
			this._tableName.aliased = tableName;

		} else {
			// Set aliased tableName
			this._tableName.aliased = '"' + dbConfig.table.name + '" a';
		}


		///// INIT PRE-DEFINED QUERIES /////


		//// RETURN ALL - Returns all values in the given table, with their associated alias.
		var returnValue = '';
		for (var alias in this._fields) {
			for (var key in this._fields[alias]) {
				if ('dbName' in this._fields[alias][key]) {
					returnValue += alias + '."' + this._fields[alias][key].dbName + '" AS ' + key + ', ';
					continue;
				}
				returnValue += alias + '.' + key + ', ';
			}
		}
		this._returnAll = returnValue.slice(0, -2);


		//// CREATE RECORD - Writes query and then sets up an object with everything set to null
		var queries = {};
		var values = {};

		// Loop over the fields in the record and asign them to the correct value object and query string, based on their alias.
		for (var alias in this._fields) {
			queries[alias] = {
				columns: '',
				values: ''
			};
			values[alias] = {};

			for (var key in this._fields[alias]) {
				// Skip primary key
				if(key == this._primaryKey[alias]) { continue; }

				// Set all values to null
				values[alias][key] = null;

				// Alias the table name if it is required and then add the string to the string for the current table
				var aliased = 'dbName' in this._fields[alias][key] ? this._fields[alias][key].dbName : key;
				queries[alias].columns += alias + '."' + aliased + '", ';
				queries[alias].values += '@' + key + ', ';
			}
		}

		var query = {
			queries: [],
			lookup: {}
		};
		for (var alias in queries) {
			if ( alias == 'a' ) { continue; }
			// Write the insert statement for this query
			var string = 'INSERT INTO "' + this._tableName.seperate[alias] + '" ( ' + queries[alias].columns.slice(0, -2) + ' ) VALUES ( ' + queries[alias].values.slice(0, -2) + ' ) SELECT SCOPE_IDENTITY()';

			var linkID = typeof this._linkID[alias] === 'object' ? this._linkID[alias].label : this._linkID[alias];
			query.queries.push({
				string: string,
				values: values[alias],
				linkID: 'linkOn' in this._linkID[alias] ? undefined : linkID
			});
			query.lookup[alias] = query.queries.length - 1;
		}

		var len = query.queries.length;
		var string = 'INSERT INTO "' + this._tableName.seperate['a'] + '" ( ' + queries['a'].columns.slice(0, -2) + ' ) VALUES ( ' + queries['a'].values.slice(0, -2) + ' )';
		var linkID = [];
		for (var i = 0; i < len; i++) {
			linkID.push({
				pos: len - i,
				id: query.queries[i].linkID,
				key: ''
			});
		}
		query.queries.push({
			string: string,
			values: values['a'],
			link: linkID
		});
		query.lookup.a = query.queries.length - 1;

		this.createAll = query;

	}

	// Function that runs a query
	_runQuery(queries) {
		var self = this;

		return new Promise(function(resolve, reject) {
			// Instantiate Connection Object
			var conn = new sql.Connection(self._connection);

			// Connect to the Database
			conn.connect().then(function() {

				if (!Array.isArray(queries)) { queries = [queries]; }

				// Init the transaction
				var transaction = new sql.Transaction(conn);
				transaction.begin(function(err) {

					// Listen for rollback events
					var rolledBack = false;
					transaction.on('rollback', function(aborted) {
						rolledBack = true;
					});

					// Init the iteration tracker
					var tracker = {
						counter: 0,
						log: [],
						result: []
					};

					// Use the runTransaction function to recursively run all the queries passed to this function in a single transaction, which can then be rolledBack.
					self._runTransaction(queries, transaction, tracker).then( function(_tracker) {
						// Commit the transaction if all queries were succesful
						transaction.commit(function(error) {
							if(error) {
								console.log(error);
								reject(error, _tracker);
							}
						});
						conn.close();

						// Return any results from the queries to the calling function. Multiple results will be returned as an array.
						if(_tracker.result.length == 1) {
							resolve(_tracker.result[0]);
						} else {
							resolve(_tracker.result);
						}
					}, function(_tracker) {
						// Make sure it rolled back, if it didn't then force it.
						if(!rolledBack) {
							transaction.rollback(function(error) {
								console.log(error);
							});
						}
						conn.close();
						reject(_tracker.log);
					});
				});
			}, function(err) {
				console.log(err);
				reject(err);
			});
		});
	}

	// Recursively runs querys within a single transaction. Queries should be run using the run query function, not this.
	_runTransaction(queries, transaction, _tracker) {
		var self = this;

		return new Promise(function(resolve, reject) {
			if (_tracker.counter >= queries.length) {
				resolve(_tracker);
			} else {
				// Init new query
				var req = new sql.Request(transaction);


				if('link' in queries[_tracker.counter]) {
					for (var i in queries[_tracker.counter].link ) {
						var link = queries[_tracker.counter].link[i];
						var result = _tracker.result[0][(_tracker.counter - link.pos)][link.key];
						queries[_tracker.counter].values[link.id] = result;
					}
				}

				// Add input values
				if ( 'values' in queries[_tracker.counter] ) {
					for (var key in queries[_tracker.counter].values) {
						var alias = self._fieldValid(key);
						var field = self._fields[alias][key];

						// Type check the values to make sure they are valid.
						if ( 'length' in field ) {
							if (field.length == 'MAX') {
								req.input(key, sql[field.type](sql.MAX), queries[_tracker.counter].values[key]);
							} else {
								req.input(key, sql[field.type](field.length), queries[_tracker.counter].values[key]);
							}
						} else {
							req.input(key, sql[field.type], queries[_tracker.counter].values[key]);
						}
					}
				}

				// Run the query
				req.query(queries[_tracker.counter].string).then(function(recordset) {
					// Push any results to the tracker and increment counter
					if (recordset != null) {
						_tracker.result.push(recordset);
					} else {
						_tracker.result.push(null);
					}
					_tracker.counter++;

					// Recurse to the next query in the input array
					process.nextTick(function() {
						self._runTransaction(queries, transaction, _tracker).then(function () {
							resolve(_tracker);
						}, function(err) {
							reject(_tracker);
						});
					});
				}, function(err) {
					console.log(err);
					_tracker.log.push('Step ' + counter + ' Failed: ' + err);
					reject(_tracker);
				});
			}
		});
	}

	// Function that lists the return values for a get request.
	_returnValues(search) {
		var self = this;

		if ('returnValues' in search) {

			if (!Array.isArray(search.returnValues)) { search.returnValues = [search.returnValues]; }
			var returnValue = '';

			for (var i in search.returnValues) {
				var key = search.returnValues[i];
				var alias = self._fieldValid(key);
				if (alias !== false) {
					if ('dbName' in self._fields[alias][key]) {
						returnValue += alias + '."' + self._fields[alias][key].dbName + '" AS ' + key + ', ';
						continue;
					}
					returnValue += alias + '.' + key + ', ';
				} else {
					console.log("Invalid ReturnValue");
				}
			}
			return returnValue.slice(0, -2);
		} else {
			return self._returnAll;
		}
	}

	// Function that creates the WHERE clause for a specific get request
	_filters(search) {
		var self = this;
		var filter = '';
		var values = {};

		if ('filters' in search) {
			filter += 'WHERE ';

			for (var key in search.filters) {
				var alias = self._fieldValid(key);
				if (alias !== false) {
					var label = key;
					if (self._queries !== false && key in self._queries.query.values) {
						label = key + '1';
					}

					var aliased = 'dbName' in self._fields[alias][key] ? self._fields[alias][key].dbName : key;
					filter += alias + '."' + aliased + '"';
					filter += search.filters[key] == 'NULL' ? 'IS NULL' : '=@' + label;

					// Push values to values array
					if (search.filters[key] !== 'NULL') {
						values[label] = search.filters[key];
					}

					filter += ' AND ';
				} else {
					console.log("Invalid Search Filter " + key);
				}
			}
			return { string: filter.slice(0, -5), values: values }
		} else {
			return false;
		}
	}

	// Function that adds OrderBy & GroupBy functionality
	_manipulators(search) {
		var self = this;
		var manipulator = '';

		if ('orderBy' in search) {
			manipulator += ' ORDER BY ';

			for (var key in search.orderBy) {
				var alias = self._fieldValid(key);
				if (alias !== false) {
					var aliased = 'dbName' in self._fields[alias][key] ? self._fields[alias][key].dbName : key;
					manipulator += alias + '."' + aliased + '" ' + search.orderBy[key] + ', ';
				} else {
					console.log("Invalid OrderBy Column " + key);
				}
			}
			manipulator.slice(0, -2);
		}

		if ('groupBy' in search) {
			manipulator += ' GROUP BY ';
			if (!Array.isArray(search.groupBy)) { search.groupBy = [search.groupBy]; }

			for (var i in search.groupBy) {
				var key = search.groupBy[i];
				var alias = self._fieldValid(key);
				if (alias !== false) {
					var aliased = 'dbName' in self._fields[alias][key] ? self._fields[alias][key].dbName : key;
					manipulator += alias + '."' + aliased + '", ';
				} else {
					console.log("Invalid GroupBy Column " + key);
				}
			}
			manipulator.slice(0, -2);
		}

		if (manipulator !== '') {
			return manipulator.slice(0, -2);
		} else {
			return false;
		}
	}

	// Function to check validity of a field, returns the alias of the table it's in or false if it's invalid
	_fieldValid(fieldName) {
		var self = this;
		for (var key in self._fields) {
			if (fieldName in self._fields[key]) {
				return key;
			}
		}
		return false;
	}

	// Generates an array of queries to update a record accross multiple tables.
	_updateRecord(record) {
		var self = this;

		var create = [];

		for (var alias in self._primaryKey) {
			if (record[self._primaryKey[alias]] === undefined) { create.push(alias) }
			if (Array.isArray(record[self._primaryKey[alias]])) {
				var i = alias.charCodeAt(0) - 97;
				if (record[self._primaryKey[alias]][i] === null) { create.push(alias) }
			}
		}

		var query = [];

		if(create.length > 0) {
			query = self._createRecord(record, create);
		}

		var queries = {};
		var values = {};

		// Loop over the fields in the record and asign them to the correct value object and query string, based on their alias.
		for (var key in record) {
			var alias = self._fieldValid(key);

			if ( alias !== false && create.indexOf(alias) === -1 ) {
				if (!(alias in queries)) {
					queries[alias] = '';
					values[alias] = {};
				}

				if (record[key] == '') { record[key] = null }
				if (self._fields[alias][key].type === 'DateTime') { record[key] = new Date(record[key]) }
				values[alias][key] = record[key];

				// Skip primary key from update query
				if(key == self._primaryKey[alias]) { continue; }
				// Alias the table name if it is required and then add the string to the string for the current table
				var aliased = 'dbName' in self._fields[alias][key] ? self._fields[alias][key].dbName : key;
				queries[alias] += alias + '."' + aliased + '"=@' + key + ', ';
			} else {
				console.log('Invalid Field to update: ' + key);
			}
		}

		// Create a seperate query object for each aliased table and then return to the update function
		for (var alias in queries) {
			// Skip tables that require no update
			if (queries[alias] == '') { continue; }

			// Handle ID
			values[alias][self._primaryKey[alias]] = Array.isArray(record[self._primaryKey[alias]]) ? record[self._primaryKey[alias]][alias.charCodeAt() - 97] : record[self._primaryKey[alias]];

			// Resolve the linkID
			var linkID = typeof self._primaryKey[alias] === 'object' ? self._primaryKey[alias].dbName + '"=@' + self._primaryKey[alias].label : self._primaryKey[alias] + '"=@' + self._primaryKey[alias];

			// Write Update Statement
			var string = 'UPDATE ' + alias + ' SET ' + queries[alias].slice(0, -2) +' FROM "' + self._tableName.seperate[alias] + '" ' + alias + ' WHERE ' + alias + '."' + linkID + ' ';

			query.push({
				string: string,
				values: values[alias]
			});
		}
		return query;
	}

	_createRecord(record, filter) {
		filter = filter || 'all';
		var self = this;
		if(record[self._primaryKey.a] !== undefined) {
			return self._updateRecord(record);
		} else {
			var query = self.createAll;
			for (var key in record) {
				var alias = self._fieldValid(key);
				if ( alias !== false ) {
					if ( filter == 'all' || filter.indexOf[alias] !== -1 ) {
						if (self._fields[alias][key].type === 'DateTime') { record[key] = new Date(record[key]) }
						query.queries[query.lookup[alias]].values[key] = record[key];
					}
				} else {
					console.log('Invalid Field to update: ' + key);
				}
			}
			console.log(query.queries[0].values);
			if ( filter == 'all' ) {
				return query.queries;
			}
			var queries = []
			for (var i in filter) {
				var alias = filter[i];
				queries.push(query.queries[query.lookup[alias]]);
			}
			return queries;
		}
	}

	_deleteRecord(value) {
		var self = this;

		var queries = [];

		for (var key in value) {
			if (self._multipleTables) {
				var alias = self._fieldValid(key);
				if ( alias === 'a') {
					var query = {
						string: "SELECT " + self._returnAll + " FROM " + self._tableName.aliased + ' WHERE a.' + key + '=@' + key,
						values: {}
					}
					query.values[key] = value[key];
					queries.push(query);
					var query = {
						string: 'DELETE FROM "' + self._tableName.seperate['a'] + '" WHERE "' + key + '"=@' + key,
						values: {}
					}
					query.values[key] = value[key];
					queries.push(query);

					var counter = 0;
					for (var alias in self._linkID) {
						if ( alias == 'a' ) { continue; }

						var linkID = typeof self._linkID[alias] === 'object' ? self._linkID[alias].label : self._linkID[alias];
						var link = [{
							pos: counter + 2,
							id: 'linkOn' in this._linkID[alias] ? undefined : linkID,
							key: 'linkOn' in this._linkID[alias] ? undefined : linkID
						}];
						var query = {
							string: 'DELETE FROM "' + self._tableName.seperate[alias] + '" WHERE "' + key + '"=@' + linkID,
							values: {},
							link: link
						}
						queries.push(query);
						counter++;
					}

				} else {
					console.log('Invalid Field to Delete: ' + key);
				}
			} else {
				var query = {
					string: 'DELETE FROM "' + self._tableName.seperate['a'] + '" WHERE "' + key + '"=@' + key,
					values: {}
				}
				query.values[key] = value[key];
				queries.push(query);
			}
		}
		return queries;
	}


}

module.exports = DB;
