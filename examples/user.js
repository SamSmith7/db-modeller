// Load Dependencies
var express = require('express');
var app = express();

// Load DB Models
var user = require('./models/users');

// Select All Users
app.get('/users', (req, res) => {
	var search = {
		returnValues: ['ID', 'Name']
 	};
	user.get(search).then(function(result) {
		res.send(result);
	}, function(error) {
		res.status(500).send(error);
	});
});

// Select User by ID
app.get('/users/:id', (req, res) => {
	user.getOne({ID: req.params.id}).then(function(result) {
		res.send(result);
	}, function(error) {
		console.log(error);
		res.status(500).send(error);
	});
});

// Update User by ID
app.put('/users/:id', (req, res) => {
	user.update(req.body).then(function(result) {
		res.io.to(req.params.id).emit('client::update', req.body);
		res.send('Updated Client ' + req.body.ID);
	}, function(error) {
		res.status(500).send(error);
	});

});

// Create User
app.put('/users/', (req, res) => {
	user.create(req.body).then(function(result) {
		res.send('Created Client');
	}, function(error) {
		res.status(500).send(error);
	});

});

// Delete User by ID
app.delete('/users/:id', (req, res) => {
	user.delete({ID: req.params.id}).then(function(result) {
		res.send('Deleted Client ' + req.params.id);
	}, function(error) {
		res.status(500).send(error);
	});

});

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});
