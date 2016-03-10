'use strict';
/*jshint -W089 */
/*jshint -W121 */
/*jshint camelcase:false */
/*jshint maxcomplexity:11 */

// Fix for Safari and any other browser missing endsWith
if(typeof String.prototype.endsWith !== 'function'){
  String.prototype.endsWith = function(suffix){
    return this.indexOf(suffix,this.length-suffix.length) !== -1;
  };
}

if(typeof String.prototype.startsWith !== 'function'){
  String.prototype.startsWith = function(prefix){
    return this.indexOf(prefix) === 0;
  };
}


var v;

(function(){
	v = {};

	v.prefix = '';
	v.suffix = '';
	v.img_suffix = '';

	v.data_url = function(resource) {
		return v.prefix + resource + v.suffix;
	};

	v.img_url = function(resource) {
		return v.prefix + resource + v.img_suffix;
	};

  v.tabulate_functions = function(functions,pattern,rowMatch,colMatch) {
    var rows = [];
    functions.forEach(function(f) {
      var match = f.Name.match(pattern);
      if(match!==null) {
        var row = match[rowMatch];
        var col = match[colMatch];
        var matchingRows = rows.filter(function(r){return r.index===row;});
        var theRow;
        if(matchingRows.length===0) {
          theRow = {index:row};
          rows.push(theRow);
        } else {
          theRow = matchingRows[0];
        }
        theRow[col]=parseFloat(f.Expression);
      }
    });
    return rows;
  };

  v.categorise_functions = function(functions,pattern,fields) {
    var matches = [];
    functions.forEach(function(f) {
      var match = f.Name.match(pattern);
      if(match!==null) {
        var categorised = {};
        for(var fieldName in fields) {
          categorised[fieldName] = match[fields[fieldName]];
        }
        categorised.value=parseFloat(f.Expression);
        matches.push(categorised);
      }
    });
    return matches;
  };

  v.group_by = function(data,field,grouper) {
    var result = [];
    data.forEach(function(d) {
      var key = d[field];
      var matchingRows = result.filter(function(r){return r[field]===key;});
      var theRow;
      if(matchingRows.length===0) {
        theRow = {};
        theRow[field] = key;
        theRow.values = [];
        result.push(theRow);
      } else {
        theRow = matchingRows[0];
      }
      theRow.values.push(d);
    });
    for(var i in result) {
      var group = result[i];
      group.value = grouper(group.values);
    }
    return result;
  };

  /* Adapted from Array.joinWith - shim by Joseph Myers 7/6/2013
    http://stackoverflow.com/a/17504827
  */
  v.outerJoin = function(lhs, rhs, lhsOn, rhsOn, select, omit,inner) {
    var together = [], length = 0;
    if (select){ select.map(function(x){select[x] = 1;});}
    function fields(it) {
        var f = {}, k;
        for (k in it) {
            if (!select) { f[k] = 1; continue; }
            if (omit ? !select[k] : select[k]){ f[k] = 1;}
        }
        return f;
    }
    var on = lhsOn;
    function add(it) {
        var pkey = '.'+it[on], pobj = {};
        if (!together[pkey]){
          together[pkey] = pobj;
          together[length++] = pobj;
        }
        pobj = together[pkey];
        for (var k in fields(it)){
            pobj[k] = it[k];
        }
    }
    lhs.map(add);
    on = rhsOn;
    rhs.map(add);
    return together;
  };

  /* modified from http://stackoverflow.com/a/17500836 */
  v.innerJoin = function(primary, foreign, primaryKey, foreignKey, select) {
    var m = primary.length, n = foreign.length, index = [], c = [];
    if(!select) {
      select = function(a,b){
        var result = {};
        for(var k in a){ result[k] = a[k];}
        for(k in b){ result[k] = b[k];}
        return result;
      };
    }

    for (var i = 0; i < m; i++) {     // loop through m items
        var row = primary[i];
        index[row[primaryKey]] = row; // create an index for primary table
    }

    for (var j = 0; j < n; j++) {     // loop through n items
        var y = foreign[j];
        var x = index[y[foreignKey]]; // get corresponding row from primary
        if(x){
          c.push(select(x, y));         // select only the columns you need
        }
    }

    return c;
  };

  v.lookupFirst = function(data,field,value) {
    for (var d in data) {
      if(data[d][field]===value){ return data[d];}
    }
    return undefined;
  };

  v.sum_field = function(field) {
    var result = function(group) {
      var sum = 0;
      group.forEach(function(entry) {
        sum += entry[field];
      });
      return sum;
    };
    return result;
  };

  v.roundTo = function (val,decimalPlaces) {
    var mult = Math.pow(10,decimalPlaces);
    return Math.round(mult*val)/mult;
  };

  v.features_of_type = function(data,type) {
    var features = data.features.filter(function(f) {
      return f.properties.feature_type===type;
    });
    return {type:'FeatureCollection',features:features};
  };

  v.catchments_from_network = function(data) {
    return v.features_of_type(data,'catchment');
  };

  v.links_from_network = function(data) {
    return v.features_of_type(data,'link');
  };

  v.nodes_from_network = function(data) {
    return v.features_of_type(data,'node');
  };

  v.match_links_to_catchments = function(links,catchments) {
    var result = [];
    catchments.features.forEach(function(c){
      result.push({catchment:c,link:links.features.filter(function(l){
        return l.id===c.properties.link;
      })[0]});
    });
    return result;
  };

  v.partition_network = function(nodes,linkCatchmentMap,borderMarkerPrefix,record) {
    var result = [];
    var links = linkCatchmentMap.map(function(lAndC){return lAndC.link;});

    // Find matching nodes
    var markerNodes = nodes.features.filter(function(n){return n.properties.name.startsWith(borderMarkerPrefix);});
    var markerLinks = links.filter(function(l){return l.properties.name.startsWith(borderMarkerPrefix);});

    var markers = markerNodes.map(function(n){return {node:n};}).concat(
      markerLinks.map(function(l){return {link:l};}));

    var i = 0;

    var fromNode = function(l){
      return nodes.features.filter(function(n){return n.id===l.properties.from_node;})[0];
    };

    markers.forEach(function(outlet){
      var region = {node:outlet.node,links:[],catchments:[]};

      var propertyValue = (outlet.node||outlet.link).properties.name.replace(borderMarkerPrefix,'');
      record(region,propertyValue);
      region.index = i;

      if(outlet.link) {
        var catchment = linkCatchmentMap.filter(function(lAndC){return lAndC.link===outlet.link;})[0].catchment;
        record(outlet.link.properties,propertyValue);
        record(catchment.properties,propertyValue);
        region.links.push(outlet.link);
        region.catchments.push(catchment);
      }

      var searchNodes = [outlet.node||fromNode(outlet.link)];

      while(searchNodes.length>0) {
        var node = searchNodes.pop();

        var linksAndCatchments = linkCatchmentMap.filter(function(lAndC){
          return lAndC.link.properties.to_node === node.id;
        });

        linksAndCatchments.forEach(function(lAndC){
          if(lAndC.link.properties.name.startsWith(borderMarkerPrefix)) {
            return;
          }

          record(lAndC.link.properties,propertyValue);
          record(lAndC.catchment.properties,propertyValue);
          region.links.push(lAndC.link);
          region.catchments.push(lAndC.catchment);
          nodes.features.filter(function(n){return n.id===lAndC.link.properties.from_node;})
            .forEach(function(n){
              if(!n.properties.name.startsWith(borderMarkerPrefix)) {
                searchNodes.push(n);
              }
          });
        });
      }
      result.push(region);
      i++;
    });

    return result;
  };

  v.subtract = function(lhs,rhs) {
    var result = [];
    var rhsTS = false;
    if(rhs.length) {
      v.assert(lhs.length === rhs.length);
      rhsTS = true;
    }

    for(var ts in lhs) {
      var lhsE = lhs[ts];
      var rhsE = rhsTS?rhs[ts]:rhs;
      var newE = {};
      v.assert(!rhsTS || (lhsE.date.getTime()===rhsE.date.getTime()));
      newE.date = lhsE.date;
      for(var col in lhsE) {
        if(col==='date'){ continue;}

        newE[col] = lhsE[col]-(rhsTS?rhsE[col]:rhsE);
      }
      result.push(newE);
    }

    return result;
  };

  v.plus = function(lhs,rhs) {
    var result = [];
    v.assert(lhs.length === rhs.length);
    for(var ts in lhs) {
      var lhsE = lhs[ts];
      var rhsE = rhs[ts];
      var newE = {};
      v.assert(lhsE.date.getTime()===rhsE.date.getTime());
      newE.date = lhsE.date;
      for(var col in lhsE) {
        if(col==='date'){ continue;}

        newE[col] = lhsE[col]+rhsE[col];
      }
      result.push(newE);
    }

    return result;
  };

  v.concentration = function(timeseries) {
    var result = [];
    for(var ts in timeseries) {
      var e = timeseries[ts];
      var newE = {};
      newE.date = e.date;
      for(var col in e) {
        if(col==='date'){ continue;}
        if(col==='Flow'){ continue;}

        newE[col] = e[col]/e.Flow;
      }
      result.push(newE);
    }

    return result;
  };

  v.scale = function(timeseries,factors,renames) {
    var result = [];
    for(var ts in timeseries) {
      var lhsE = timeseries[ts];
      var newE = {};
      ['date','Date'].forEach(function(col){
        if(lhsE[col]){
          newE[col] = lhsE[col];
        }
      });
      for(var col in lhsE) {
        if(col.toLowerCase()==='date'){ continue;}
        var newCol = (renames&&renames[col]) ? renames[col] : col;
        newE[newCol] = lhsE[col]*(factors[col]||factors.default||factors);
      }
      result.push(newE);
    }

    return result;
  };

  v.rolling = function(timeseries,period) {
    var result = [];
    var rolling = {};
    var count = 0;

    for(var row in timeseries) {
      var entry = timeseries[row];
      var newE = {};
      ['date','Date'].forEach(function(col){
        if(entry[col]){
          newE[col] = entry[col];
        }
      });

      var col;
      if(count<=period) {
        for(col in entry) {
          if(col.toLowerCase()==='date'){ continue;}

          rolling[col] = (rolling[col]||0) + entry[col];
        }
        count++;
      }

      if(count>period) {
        for(col in entry) {
          if(col.toLowerCase()==='date'){ continue;}
          rolling[col] -= timeseries[row-period][col];
        }
        count--;
      }

      for(col in entry) {
        if(col.toLowerCase()==='date'){ continue;}
        newE[col] = rolling[col]/count;
      }

      result.push(newE);
    }

    return result;
  };

  v.numberOrder = function(a,b){return a-b;};

  v.slice = function(timeseries,start,length) {
    var startNum = +start;
    return timeseries.filter(function(e){
      return +e.Date >= startNum;
    }).slice(0,length);
  };

  v.deciles_from_array = function(array,deciles) {
    // Adapted from http://stackoverflow.com/a/24049361
    var result = {};
    array.sort(v.numberOrder);

    for(var i in deciles) {
      var d = deciles[i];
      var index = d * array.length;
      if (Math.floor(index) === index) {
         result[d] = (array[index-1] + array[index])/2;
      } else {
        result[d] = array[Math.floor(index)];
      }
    }
    return result;
  };

  v.deciles = function(timeseries,deciles) {
    var arrays = {};
    for(var col in timeseries[0]){
      if(col==='date'){
        continue;
      }
      else{
        arrays[col]=[];
      }
    }

    for(var ts in timeseries) {
      for(col in arrays) {
        arrays[col].push(timeseries[ts][col]);
      }
    }

    var result = {};
    for(col in arrays) {
      result[col] = v.deciles_from_array(arrays[col],deciles);
    }
    return result;
  };

  v.assert = function(expr){
    if(console){
      console.assert(expr);
    }
  };

  v.configureRecorders = function(switchOn,switchOff) {
    var translate = function(rule){
      return 'location/'+rule.NetworkElement+
             '/element/'+rule.RecordingElement+
             '/variable/'+(rule.RecordingVariable||rule.RecordingElement);
    };

    return {
      RecordNone: switchOff?switchOff.map(translate):[],
      RecordAll: switchOn.map(translate)
    };
  };
})();
