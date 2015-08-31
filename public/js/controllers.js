
/* Controllers */

function GraphCtrl($scope, $http, $location) {
  var graphDiv = d3.select("#graph");
  var currId = null;
  var isEditable = false;

  $scope.isEditable = function() {
	return isEditable;
  }

  $scope.idIndex = function(a, id) {
	for (var i = 0; i < a.length; i++) {
	  if (a[i].id == id) return i;
	}
	return null;
  }

  function displayElements(elem, action) {
	var display;
	if (action == "hide") display = "none";
	else if (action == "show") display = "";
	for (var i = 0; i < elem.length; ++i) {
	  console.log(elem[i]);
	  elem[i].style.display = display;
	}
  }

  function loadData() {
  	var postData = {"statements": [{"statement": "MATCH path = (p:Person)-[r]->(c:Person) RETURN path",
								  "resultDataContents": ["graph"]}]};
  	$.ajax({
	   type: "POST",
	   accept: "application/json",
	   contentType:"application/json; charset=utf-8",
	   url: "http://localhost:7474/db/data/transaction/commit",
	   data: JSON.stringify(postData),
	   success: function(data, textStatus, jqXHR) {
		  $scope.drawGraph(data);
		  //console.log("Hola");
	   },
	   failure: function(msg) {
		  console.log("failed");
	   }
  	});
  }

  $scope.drawGraph = function(data) {
	var nodes = [];
	var links = [];
	data.results[0].data.forEach(function (row) {
	  row.graph.nodes.forEach(function (n) {
		var node = {id: n.id,
					label: n.labels[0],
					title: n.properties.name};
		if ($scope.idIndex(nodes,n.id) == null) nodes.push(node);
	  });
	  links = links.concat(row.graph.relationships.map(function (r) {
		return {source: $scope.idIndex(nodes, r.startNode),
						target: $scope.idIndex(nodes, r.endNode),
						type: r.type, 
						value: 1};
	  }));
	});
	graph = {nodes: nodes, links: links};
	var width = 800;
	var height = 800;
	var force = d3.layout.force()
				  							.charge(-800).linkDistance(200).size([width, height]);
	var svg = d3.select("#graph").append("svg")
							.attr("width", 700).attr("height", 800)
							.attr("pointer-events", "all");
	force.nodes(graph.nodes).links(graph.links).start();
	var link = svg.selectAll(".link")
							  .data(graph.links).enter()
							  .append("line").attr("class", "link");
	var nodeColor = {"Person": "#80E810", 
									 "Place": "#10DDE8"};
	var linkColor = {"ParentOf": "#AA0000",
					 				 "CoupleOf": "#0000AA"}
	var node = svg.selectAll(".node")
							  .data(graph.nodes).enter()
							  .append("circle")
							  .attr("class", function (d) { 
									return "node "+d.label;
							  })
							  .attr("r", 10)
							  .attr("fill", function (d) {
									return nodeColor[d.label];
							  })
							  .call(force.drag)
							  .on("click", function (d) {
									displayElements([document.getElementById("sidePanel")], "show");
									currId = d.id;
									$scope.getNodeData(currId);
							  })
		node.append("title")
				.text(function (d) {
				  return d.title; 
				});
	force.on("tick", function() {
	  link.attr("x1", function (d) { 
			return d.source.x; 
		 })
			  .attr("stroke", function (d) {
					return linkColor[d.type];
			  })
			  .attr("y1", function (d) { 
					return d.source.y; 
			  })
			  .attr("x2", function (d) { 
					return d.target.x; 
			  })
			  .attr("y2", function (d) { 
					return d.target.y; 
			  });
		node.attr("cx", function (d) { 
			return d.x; 
		})
			  .attr("cy", function (d) { 
					return d.y; 
			  });
	});
  };

  function displayElements(elem, action) {
	var display;
	if (action == "hide") display = "none";
	else if (action == "show") display = "";
	for (var i = 0; i < elem.length; ++i) elem[i].style.display = display;
  }
  
  $scope.hidePanel = function() {
	document.getElementById("sidePanel").style.display = "none";
  }

  $scope.getNodeData = function(id) {
	console.log("id = "+id);
	$http.get("/api/nodeData/"+id).success(function (data) {
	  console.log(data.data[0]);
	  $scope.data = {name: data.data[0].name,
									 surnames: data.data[0].surnames, 
									 sex: data.data[0].sex, 
									 birthDate: data.data[0].birthDate, 
									 deathDate: data.data[0].deathDate,
									 birthPlace: data.data[0].birthPlace,
									 residPlaces: data.data[0].residPlaces,
									 deathPlace: data.data[0].deathPlace};
		console.log($scope.data);
	  temp_data.name = $scope.data.name;
	  temp_data.surnames = $scope.data.surnames; 
	  temp_data.sex = $scope.data.sex;
	  temp_data.birthDate = $scope.data.birthDate;
	  temp_data.deathDate = $scope.data.deathDate;
	  temp_data.birthPlace = $scope.data.birthPlace;
	  temp_data.residPlaces = $scope.data.residPlaces;
	  temp_data.deathPlace = $scope.data.deathPlace;
	});
  }

  $scope.isNull = function(data) {
	if (!data) return true;
	else return false;
  }

  $scope.deletePlace = function(position) {
  	console.log(position);
  	$scope.data.residPlaces.splice(position, 1);
  	for (var i = position; i < $scope.data.residPlaces.length; ++i) $scope.data.residPlaces[i].position = i;
  	console.log($scope.data.residPlaces);
  }

  $scope.addPlace = function() {
  	if (!$scope.data.residPlaces) $scope.data.residPlaces = [];
  	$scope.data.residPlaces.push({position: $scope.data.residPlaces.length})
  	console.log($scope.data.residPlaces);
  }

  $scope.enableEditForm = function() {
	displayElements(messages, "hide");
	isEditable = true;
	$scope.data.name = temp_data.name;
	$scope.data.surnames = temp_data.surnames;
	$scope.data.sex = temp_data.sex;
	$scope.data.birthDate = temp_data.birthDate;
	$scope.data.deathDate = temp_data.deathDate;
	$scope.data.birthPlace = temp_data.birthPlace;
	$scope.data.residPlaces = temp_data.residPlaces;
	$scope.data.deathPlace = temp_data.deathPlace;
  }

  $scope.disableEditForm = function() {
	displayElements(messages, "hide");
	isEditable = false;
	$scope.data.name = temp_data.name;
	$scope.data.surnames = temp_data.surnames;
	$scope.data.sex = temp_data.sex;
	$scope.data.birthDate = temp_data.birthDate;
	$scope.data.deathDate = temp_data.deathDate;
	$scope.data.birthPlace = temp_data.birthPlace;
	$scope.data.residPlaces = temp_data.residPlaces;
	$scope.data.deathPlace = temp_data.deathPlace;
  }

  $scope.editData = function() {
	displayElements(messages, "hide");
	var validForm = true;
	var params = {name: $scope.data.name,
								surnames: $scope.data.surnames,
								sex: $scope.data.sex,
								birthDate: $scope.data.birthDate,
								deathDate: $scope.data.deathDate,
								birthPlace: $scope.data.birthPlace,
								residPlaces: $scope.data.residPlaces,
								deathPlace: $scope.data.deathPlace};
	if (!params.name) {
	  messages[6].style.display = "";
	  messages[0].style.display = "";
	  validForm = false;
	}
	if (!params.surnames) {
	  messages[6].style.display = "";
	  messages[1].style.display = "";
	  validForm = false;
	}
	if (!params.sex) {
	  messages[6].style.display = "";
	  messages[2].style.display = "";
	  validForm = false;
	}
	if (!params.birthDate) {
	  messages[6].style.display = "";
	  messages[3].style.display = "";
	  validForm = false;
	}
	if (params.deathDate && (params.birthDate > params.deathDate)) {
	  messages[6].style.display = "";
	  messages[4].style.display = "";
	  validForm = false;
	}
	if (!params.birthPlace) {
	  messages[6].style.display = "";
	  messages[5].style.display = "";
	  validForm = false;
	}
	console.log(validForm);
	if (validForm) {
	  $http.post("/api/editNode/"+currId, params).success(function () {
	  	console.log("Se ha editado correctamente");
	  	$scope.getNodeData(currId);
		$scope.disableEditForm();
		loadData();
	  })
	}
  }

  $scope.form = {};
  var temp_data = {name: "name",
				   surnames: "surnames",
				   sex: "sex",
				   birthDate: "birthDate",
				   deathDate: "deathDate",
				   birthPlace: "birthPlace",
				   residPlaces: "residPlaces",
				   deathPlace: "deathPlace"};
  var messages = [];
  messages[0] = document.getElementById("name");
  messages[1] = document.getElementById("surnames");
  messages[2] = document.getElementById("sex");
  messages[3] = document.getElementById("birthDate");
  messages[4] = document.getElementById("dates");
  messages[5] = document.getElementById("birthPlace");
  messages[6] = document.getElementById("alerts");
  var validForm = true;
  displayElements(messages, "hide");
  displayElements([document.getElementById("sidePanel")], "hide");
  loadData();
}