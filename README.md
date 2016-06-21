# db-modeller
This module creates a way to model MS SQL tables within a Node.JS environment. These models can then be used to quickly and flexibly query the underlying database with a simple Mongoose-style API which can be used throughout the rest of the code. Currently only the CRUD operations are supported, but there are plans to expand this to the full range of SQL functions available. All queries that are run on a particular model are run as a single transaction, properly type checked and all user input is parameterised to prevent sql injection attacks. The module is built ontop of the node-mssql package for actual communication with the underlying database. 


##### NOTE: This Readme is still WIP as are example usage cases!! The module does a lot more than is currently documented


## Creating Simple Models
For example models, see the examples/models folder. Models are effectively just literal Javascript objects which define the fields, primary key and any joins/linked-tables that are required. For example a simple single table model would look like the one below. 

```javascript
var db = require('db');

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
```

With this model defined and assuming that it is in a file called users.js, then it can be imported into a node application easily using the following syntax: 

```javascript
var users = require('users');
```

From this point the users variable now holds an instance of the db module set up to use the Users table in the database.

## The API

All the API methods return a promise, which is called when the data is returned from the database. Any errors are automatically logged to the console, but won't crash the application.

### Get(search)
The main read function, which simply reads data out of the database. It takes a search object as an argument to refine what records are returned. If no search object is passed then it will return the entire table. e.g. (using the users table created above)

```javascript
users.get().then((data) => { console.log(data) };
```
Or in a simple ExpressJS Endpoint

```javascript
app.get('/users' function(req, res) {
	users.get().then(function(result) {
		res.send(result);
	}, function(error) {
		res.status(500).send(error);
	});
});
```

#### Customising the search

The search object has a range of parameters that can be used to filter and refine the results of the search:

```javascript
var search = {
  returnValues: // Pass a field name or array of field names to be returned
  filters: // Pass an object, where the key is the field and the value is value of that field.
  orderBy: // Pass an object, where the key is the field and the value is either 'ASC' or 'DESC'.
  groupBy: // Pass a field name or array of field names to group the results by. Grouping will be done in the order they're listed.
}
```

For example if you wanted to retrieve a certain user, by their ID, but not reveal their Password:

```javascript
app.get('/users' function(req, res) {
  var search = {
    returnValues: ['ID', 'Name'],
    filters: { ID: 1 } // The ID you want 
  }
	users.get(search).then(function(result) {
		res.send(result);
	}, function(error) {
		res.status(500).send(error);
	});
});
```

### GetOne(filter) and GetMany(filter)

These functions are extensions of the get function, but they handle the most common use cases for a CRUD system. If you want to retrieve all the fields of a specific record then getOne will simplify that process.

getOne(filter) only takes a filter as an argument which cleans up its syntax considerably:

```javascript
app.get('/users' function(req, res) {
	users.getOne({ ID: 1 }).then(function(result) {
		res.send(result);
	}, function(error) {
		res.status(500).send(error);
	});
});
```

Note: This function will also strip the array brackets off the response send from the database.

getMany works in a very similar fashion, but expects their to be more than one element in the response. For example if you were retreiving all the past addresses of a user. 

getMany(filter) again only takes a filter as an argument. In this example we assume that we have created an imported an address model, which will return multiple records for a given user id.

```javascript
app.get('/users/:id/addresses' function(req, res) {
	users.getMany({ ID: req.params.id }).then(function(result) {
		res.send(result);
	}, function(error) {
		res.status(500).send(error);
	});
});
```

Note: This endpoint also pulls the User ID from the URI (which is stored in the req.params object).
