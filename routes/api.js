var neo = require("neo4j");
var parser = require("parse-gedcom");
var fs = require("fs");
var path = require("path");
var sync = require("synchronize");
var db = new neo.GraphDatabase("http://localhost:7474");

sync(db, "query");

exports.allPersons = function(req, res) {
	db.query("MATCH (p:Person) RETURN p", function (err, data) {
		var results = [];
		forEach(data, function (item) {
			results.push({id: item.p._data.metadata.id, nodeData: item.p._data.data});
		})
		res.json({data: results});
	})
  sync.fiber(function() {
    var params = {};
    var result = db.query("MATCH path = (n)-[r]->(m) RETURN path", params);
    console.log(result);
  });
}

exports.newPerson = function(req, res) {
	var params = {name: req.body.name, 
                surnames: req.body.surnames,
                sex: req.body.sex,
                birthDate: req.body.birthDate,
                deathDate: req.body.deathDate,
                birthPlace: req.body.birthPlace,
                residPlace: req.body.residPlace,
                deathPlace: req.body.deathPlace}
  console.log(params);
  var query = "CREATE (p:Person {name: ({name}), surnames: ({surnames}), sex: ({sex}), birthDate: ({birthDate}),";
  if (params.deathDate) query += "deathDate: ({deathDate}),";
  query += " birthPlace: ({birthPlace}), residPlace: ({residPlace})"; 
  if (params.deathPlace) query += ", deathPlace: ({deathPlace}) })";
  else query += " })";
	db.query(query, params, function (err) {
		if (err) {
      res.json(false); 
    }
    else {
			res.json(true);
		}
	})
}

exports.editNode = function(req, res) {
  var intId = parseInt(""+req.params.id);
  var params1 = {_id: intId,
                name: req.body.name, 
                surnames: req.body.surnames,
                sex: req.body.sex,
                birthDate: req.body.birthDate,
                deathDate: req.body.deathDate,
                birthPlace: req.body.birthPlace,
                deathPlace: req.body.deathPlace};
  var query = "MATCH (p:Person) WHERE id(p) = ({_id}) SET ";
  if (params1.name) query += "p.name = ({name})";
  if (params1.surnames) query += ", p.surnames = ({surnames})";
  if (params1.sex) query += ", p.sex = ({sex})";
  if (params1.birthDate) query += ", p.birthDate = ({birthDate})"; 
  if (params1.deathDate) query += ", p.deathDate = ({deathDate})";
  if (params1.birthPlace) query += ", p.birthPlace = ({birthPlace})"; 
  if (params1.deathPlace) query += ", p.deathPlace = ({deathPlace})";
  sync.fiber(function () {
    db.query(query, params1);
  });
  var residPlaces = req.body.residPlaces;
  if (residPlaces) {
    sync.fiber(function() {
      for (var i = 0; i < residPlaces.length; ++i) {
        var params2 = {name: residPlaces[i].placeName};
        var result = db.query("MATCH (p:Place) WHERE p.name = ({name}) RETURN p", params2);
        if (result.length == 0) db.query("CREATE (p:Place {name: ({name}) })", params2);
      };
      for (var i = 0; i < residPlaces.length; ++i) {
        var params3 = {_id: intId,
                       placeName: residPlaces[i].placeName,
                       time: residPlaces[i].timePeriod};
        var rels = db.query("MATCH (p:Person)-[r:livedIn]->(l:Place) WHERE id(p) = ({_id}) AND l.name = ({placeName}) RETURN r", params3);
        if (rels.length == 0) {
          console.log("A ver si entra...");
          console.log(params3);
          var query = "MATCH (p:Person), (l:Place) WHERE id(p) = ({_id}) AND l.name = ({placeName}) CREATE (p)-[r:livedIn "
          if (params3.time) query += "{timePeriod: ({time})}"
          query += "]->(l) RETURN r";
          console.log(query);
          var response = db.query(query, params3);
          console.log(response);
        }
        else if (rels[0].r._data.data.timePeriod && (rels[0].r._data.data.timePeriod != params3.time)) db.query("MATCH (p:Person)-[r:livedIn]->(l:Place) WHERE id(p) = ({_id}) AND l.name = ({placeName}) SET r.timePeriod = ({time})", params3);
      }
    });
  }
  res.json(true);
}

exports.nodeData = function(req, res) {
  var params = {id: parseInt(""+req.params.id)}
  sync.fiber(function () {
    var results = [];
    var data = db.query("MATCH (p:Person) WHERE id(p) = ({id}) RETURN p", params);
    results.push({name: data[0].p._data.data.name, surnames: data[0].p._data.data.surnames, sex: data[0].p._data.data.sex, birthDate: data[0].p._data.data.birthDate, deathDate: data[0].p._data.data.deathDate, birthPlace: data[0].p._data.data.birthPlace, deathPlace: data[0].p._data.data.deathPlace});
    var residPlaces = db.query("MATCH (p:Person)-[r:livedIn]->(pl:Place) WHERE id(p) = ({id}) RETURN r, pl", params);
    if (residPlaces.length > 0) {
      results[0].residPlaces = [];
      for (var i = 0; i < residPlaces.length; ++i) results[0].residPlaces.push({position: i, placeName: residPlaces[i].pl._data.data.name, timePeriod: residPlaces[i].r._data.data.timePeriod});
    }
    res.json({data: results});
  });
}


exports.uploadAndParse = function(req, res) {
  var fileData = req.files.gedcom_file;
  var file = fs.readFileSync(fileData.path, "utf8");
  var fileSplit = file.split('\n');
  var persons = [];
  var families = [];
  var children = [];
  var residence = [];
  var isIndividual = false;
  var isFamily = false;
  var isName = false;
  var isBirth = false;
  var isDeath = false;
  var isResidence = false;
  var isMarriage = false;
  var data = {};
  var dataResidence = {};
  for (var i = 0; i < fileSplit.length; ++i) {
    var line = fileSplit[i].split(' ');
    line = deleteEndlines(line);
    if (isIndividual) {
      if (isName) {
        if (line[1] == "GIVN") {
          var given = "";
          for (var j = 2; j < line.length; ++j) {
            given += line[j];
            if (j+1 < line.length) given += " ";
          } 
          data.name = given;
        }
        if (line[1] == "SURN") {
          var surnames = ""
          for (var j = 2; j < line.length; ++j) {
            surnames += line[j];
            if (j+1 < line.length) surnames += " ";
          }
          data.surnames = surnames;
        }
        isName = !(fileSplit[i+1].split(' ')[0] == "1");
      }
      if (isBirth) {
        if (line[1] == "DATE") {
          var date = "";
          if (line.length == 5) date = parseDate(line[2], line[3], line[4]);
          else {
            for (var j = 2; j < line.length; ++j) date += line[j];
          }
          data.birthDate = date;
        }
        if (line[1] == "PLAC") {
          var birthPlace = "";
          for (var j = 2; j < line.length; ++j) {
            birthPlace += line[j];
            if (j+1 < line.length) birthPlace += " ";
          }
          data.birthPlace = birthPlace;
          //console.log("Lugar de nacimiento: "+birthPlace);
        }
        isBirth = !(fileSplit[i+1].split(' ')[0] == "1");
      }
      if (isDeath) {
        if (line[1] == "DATE") {
          var date = "";
          if (line.length == 5) date = parseDate(line[2], line[3], line[4]);
          else {
            for (var j = 2; j < line.length; ++j) date += line[j];
          }
          data.deathDate = date;
          //console.log("Fecha de defunción: "+date);
        }
        if (line[1] == "PLAC") {
          var deathPlace = "";
          for (var j = 2; j < line.length; ++j) {
            deathPlace += line[j];
            if (j+1 < line.length) deathPlace += " ";
          }
          data.deathPlace = deathPlace;
          //console.log("Lugar de defunción: "+deathPlace);
        }
        isDeath = !(fileSplit[i+1].split(' ')[0] == "1");
      }
      if (isResidence) {
        if (line[1] == "DATE") {
          var date = "";
          if (line.length == 5) date = parseDate(line[2], line[3], line[4]);
          else {
            for (var j = 2; j < line.length; ++j) date += line[j];
          }
          //console.log("Fecha de residencia: "+date);
          dataResidence.residDate = date;
        }
        if (line[1] == "PLAC") {
          var residPlace = "";
          for (var j = 2; j < line.length; ++j) {
            residPlace += line[j];
            if (j+1 < line.length) residPlace += " ";
          }
          dataResidence.residPlace = residPlace;
          //console.log("Lugar de residencia: "+residPlace);
        }
        isResidence = !(fileSplit[i+1].split(' ')[0] == "1");
        if (!isResidence) {
          if (!data.residence) data.residence = [];
          data.residence.push(dataResidence);
          dataResidence = {};
          //console.log(data.residence);
        }
      }
      else {
        switch (line[1]) {
          case "NAME":
            isName = true;
            var name = "";
            for (var j = 2; j < line.length; ++j) {
              name += line[j];
              if (j+1 < line.length) name += " ";
            }
            data.name = name.replace(/[/]/g, "");
            break;
          case "SEX":
            data.sex = line[2];
            break;
          case "BIRT":
            isBirth = true;
            break;
          case "BIRTH":
            isBirth = true;
            break;
          case "DEAT":
            isDeath = true;
            break;
          case "DEATH":
            isDeath = true;
            break;
          case "RESI":
            isResidence = true;
            break;
        }
      }
    }
    if (isFamily) {
      if (isMarriage) {
        if (line[1] == "DATE") {
          var date = "";
          if (line.length == 5) date = parseDate(line[2], line[3], line[4]);
          else {
            for (var j = 2; j < line.length; ++j) date += line[j];
          }
          data.marriageDate = date;
        }
        if (line[1] == "PLAC") {
          var marriagePlace = "";
          for (var j = 2; j < line.length; ++j) {
            marriagePlace += line[j];
            if (j+1 < line.length) marriagePlace += " ";
          }
          data.marriagePlace = marriagePlace;
        }
        isMarriage = !(fileSplit[i+1].split(' ')[0] != "2");
      }
      else {
        switch (line[1]) {
          case "HUSB":
            data.husband = line[2];
            break;
          case "WIFE":
            data.wife = line[2];
            break;
          case "CHIL":
            children.push(line[2]);
            break;
          case "MARR":
            isMarriage = true;
            break;
        }
      }
    }
    if (i+1 < fileSplit.length) {
      if (isIndividual) {
        isIndividual = !(fileSplit[i+1].split(' ')[0] == "0");
        if (!isIndividual) {
          if (objectLength(data) > 0) {
            persons.push(data);
            data = {};
          }
        }  
      }
      if (isFamily) {
        isFamily = !(fileSplit[i+1].split(' ')[0] == "0");
        if (!isFamily) {
          if (objectLength(data) > 0) {
            data.children = children;
            families.push(data);
            children = [];
            data = {};
          }
        }  
      }
      else {
        if (line[0] == "0" && line[1][0] == "@" && line[1][1] == "I") {
          data._id = line[1];
          isIndividual = true;
        }
        if (line[0] == "0" && line[1][0] == "@" && line[1][1] == "F") {
          data._id = line[1];
          isFamily = true;
        }
      }
    }
    else if (i+1 == fileSplit.length) {
      if (isIndividual) {
        if (objectLength(data) > 0) {
          persons.push(data);
          data = {};
        }
      }
      if (isFamily) {
        if (objectLength(data) > 0) {
          data.children = children;
          families.push(data);
          children = [];
          data = {};
        } 
      }
    }
  }
  sync.fiber(function() {
    for (var i = 0; i < persons.length; ++i) {
      var query = "CREATE (p:Person {";
      if (persons[i]._id) query += "_id: ({_id}), ";
      if (persons[i].name) query += "name: ({name}), ";
      if (persons[i].surnames) query += "surnames: ({surnames}), ";
      if (persons[i].sex) query += "sex: ({sex}), ";
      if (persons[i].birthDate) query += "birthDate: ({birthDate}), ";
      if (persons[i].deathDate) query += "deathDate: ({deathDate}), ";
      if (persons[i].birthPlace) query += "birthPlace: ({birthPlace}), ";
      if (persons[i].deathPlace) query += "deathPlace: ({deathPlace})";
      if (query[query.length-2] == ",") query = query.substring(0, query.length-2);
      query += " })";
      db.query(query, persons[i]);
      if (persons[i].residence) {
        for (var j = 0; j < persons[i].residence.length; ++j) {
          var params1 = {name: persons[i].residence[j].residPlace};
          var result = db.query("MATCH (p:Place) WHERE p.name = ({name}) RETURN p", params1);
          if (result.length == 0) {
            db.query("CREATE (p:Place {name: ({name}) })", params1);
          }
          var params2 = {_id: persons[i]._id,
                          placeName: persons[i].residence[j].residPlace,
                          timePeriod: persons[i].residence[j].residDate};
          var query = "MATCH (p:Person), (l:Place) WHERE p._id = ({_id}) AND l.name = ({placeName}) CREATE (p)-[r:livedIn";
          if (params2.placeDate) query += " {timePeriod: ({timePeriod})}";
          query += "]->(l)";
          db.query(query, params2);
        }
      }
      //console.log("Residencias creadas");
    }
    for (var i = 0; i < families.length; ++i) {
      if (families[i].husband && families[i].wife) {
        var query = "MATCH (h:Person), (w:Person) WHERE h._id = ({husband}) AND w._id = ({wife}) CREATE (h)-[r:CoupleOf]->(w)";
        db.query("MATCH (p:Person) WHERE p._id = ({husband})", families[i], function (err, data) {
          console.log("¿Existe? ", data);
        })
        db.query(query, families[i], function (err) {
          if (err) console.log(err);
          else console.log("Pareja creada");
        });
      }
      if (families[i].children) {
        for (var j = 0; j < families[i].children.length; ++j) {
          if (families[i].husband) {
            var params = {husband: families[i].husband,
                          children: families[i].children[j]};
            var query = "MATCH (p:Person), (c:Person) WHERE p._id = ({husband}) AND c._id = ({children}) CREATE (p)-[r:ParentOf]->(c)";
            db.query(query, params, function (err) {
              if (err) console.log(err);
              else console.log("Relación padre-hijo creada");
            })
          }
          if (families[i].wife) {
            var params = {wife: families[i].wife,
                          children: families[i].children[j]};
            var query = "MATCH (p:Person), (c:Person) WHERE p._id = ({wife}) AND c._id = ({children}) CREATE (p)-[r:ParentOf]->(c)";
            db.query(query, params, function (err) {
              if (err) console.log(err);
              else console.log("Relación madre-hijo creada");
            });
          }
        }
      }
    }
  });
  console.log("Finalizado");
}

exports.deleteNode = function(req, res) {
  var intId = parseInt(""+req.params.id);
  var params = {_id: intId};
  console.log(params);
  var deletePerson = "MATCH (p:Person) WHERE id(p) = ({_id}) DELETE p";
      deletePersonAndRels = "MATCH (p:Person)-[r]-() WHERE id(p) = ({_id}) DELETE p, r";
  var query_func = function (err) {
      if (err) {
        console.log(err);
        res.json(false);
      }
      else res.json(true);
  };
  db.query("MATCH (p:Person)-[r]-()\nWHERE id(p) = ({_id})\nRETURN r", params,
    function (err, data) {
      console.log(err || data);
      if (!err) {
        if (data.length > 0) {
          db.query(deletePersonAndRels, params, query_func);
        }
        else db.query(deletePerson, params, query_func);
      }
    });
}

function parseDate(day, month, year) {
  var strDate = "";
  strDate += year;
  strDate += "-";
  if (month.length == 3) strDate += monthParsing3(month);
  else strDate += monthParsingFuck(month);
  strDate += "-";
  if (day.length == 1) {
    var dayInt = parseInt(day);
    if (dayInt < 10) strDate += "0";
  }
  strDate += day;
  return strDate;
}

function monthParsing3(month) {
  switch (month) {
    case "JAN": return "01";
    case "Jan": return "01";
    case "FEB": return "02";
    case "Feb": return "02";
    case "MAR": return "03";
    case "Mar": return "03";
    case "APR": return "04";
    case "Apr": return "04";
    case "MAY": return "05";
    case "May": return "05";
    case "JUN": return "06";
    case "Jun": return "06";
    case "JUL": return "07";
    case "Jul": return "07";
    case "AUG": return "08";
    case "Aug": return "08";
    case "SEP": return "09";
    case "Sep": return "09";
    case "OCT": return "10";
    case "Oct": return "10";
    case "NOV": return "11";
    case "Nov": return "11";
    case "DEC": return "12";
    case "Dec": return "12";
  }
}

function monthParsingFuck(month) {
  switch (month) {
    case "January": return "01";
    case "February": return "02";
    case "March": return "03";
    case "April": return "04";
    case "May": return "05";
    case "June": return "06";
    case "July": return "07";
    case "August": return "08";
    case "September": return "09";
    case "October": return "10";
    case "November": return "11";
    case "December": return "12";
  }
}

function objectLength(object) {
  var size = 0;
  var key;
  for (key in object) {
    if (object.hasOwnProperty(key)) ++size;
  }
  return size;
}

function deleteEndlines(array) {
  for (var i = 0; i < array.length; ++i) {
    array[i] = array[i].replace('\r', '');
  }
  return array;
}

function forEach(array, fn) {
  //console.log(array);
  if (array) {
    for (var i = 0; i < array.length; ++i) {
      fn(array[i], i);
    }
  }
}