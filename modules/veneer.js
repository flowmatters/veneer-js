'use strict';
/*jshint -W089 */
/*jshint -W121 */
/*jshint camelcase:false */

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

/*
 * from http://stackoverflow.com/a/1885660
 *
 * destructively finds the intersection of
 * two arrays in a simple fashion.
 *
 * PARAMS
 *  a - first array, must already be sorted
 *  b - second array, must already be sorted
 *
 * NOTES
 *  State of input arrays is undefined when
 *  the function returns.  They should be
 *  (prolly) be dumped.
 *
 *  Should have O(n) operations, where n is
 *    n = MIN(a.length, b.length)
 */
function intersection_destructive(a, b)
{
  var result = [];
  while( a.length > 0 && b.length > 0 )
  {
     if      (a[0] < b[0] ){ a.shift(); }
     else if (a[0] > b[0] ){ b.shift(); }
     else /* they're equal */
     {
       result.push(a.shift());
       b.shift();
     }
  }

  return result;
}

var v;

var arrayFunctions = {};
arrayFunctions.min = function(vals){
  return Math.min.apply(null, vals);
};

arrayFunctions.max = function(vals){
  return Math.max.apply(null, vals);
};

arrayFunctions.mean = function(vals){
  if(!vals.length){
    return Number.NaN;
  }

  return arrayFunctions.sum(vals)/vals.length;
};

arrayFunctions.sum = function(vals){
  return vals.reduce(function(a,b){return a+b;},0);
};

var tsFunctions = {};
tsFunctions.toArray = function(ts){
  if(ts.Events){
    return ts.Events.map(function(e){return e.Value;});
  } else if(ts.length){
    return ts.map(function(e){return e.Value;});
  }
  return [];
};

tsFunctions.min = function(ts){
  if(ts.Min){
    return ts.Min;
  }

  return arrayFunctions.min(tsFunctions.toArray(ts));
};

tsFunctions.max = function(ts){
  if(ts.Max){
    return ts.Max;
  }

  return arrayFunctions.max(tsFunctions.toArray(ts));
};

tsFunctions.mean = function(ts){
  if(ts.Mean){
    return ts.Mean;
  }

  return arrayFunctions.mean(tsFunctions.toArray(ts));
};

tsFunctions.sum = function(ts){
  return arrayFunctions.sum(tsFunctions.toArray(ts));
};

tsFunctions.extractPeriod = function(ts,from,to){
  return {
    Events: ts.Events.filter(function(evt){
      return (evt.Date>=from) && (evt.Date<=to);
    })
  };
};

tsFunctions.extractYear = function(ts,year){
  return {
    Events: ts.Events.filter(function(evt){
      return evt.Date.getFullYear()===year;
    })
  };
};

tsFunctions.extractMonthAndYear = function(ts,month,year){
  return {
    Events: ts.Events.filter(function(evt){
      return (evt.Date.getFullYear()===year) &&
             (evt.Date.getMonth()===month);
    })
  };
};

tsFunctions._events = function(ts){
  return ts.Events||ts;
};

tsFunctions.intersect = function(ts1,ts2){
  var result = [
    {
      Events:[]
    },
    {
      Events:[]
    }
  ];

  var extractDate = function(evt){return evt.Date;};
  var extractDates = function(ts){
    return tsFunctions._events(ts).map(extractDate);
  };

  var intersectedIndex = intersection_destructive(extractDates(ts1),extractDates(ts2));
  var i1 = -1, i2 = -1;

  var findItemForDate = function(ts,date,startingI){
    var events = tsFunctions._events(ts);
    for(var i = (startingI+1);i<events.length;i++){
      if(events[i].Date.getTime()===date.getTime()){
        return i;
      }
    }
    return null;
  };

  intersectedIndex.forEach(function(d){
    // Will be a matching d in each of ts1 and ts2;
    i1 = findItemForDate(ts1,d,i1);
    result[0].Events.push({
      Date:d,
      Value:tsFunctions._events(ts1)[i1].Value
    });

    i2 = findItemForDate(ts2,d,i2);
    result[1].Events.push({
      Date:d,
      Value:tsFunctions._events(ts2)[i2].Value
    });
  });

  return result;
};

tsFunctions.sumForPeriod = function(ts,from,to){
  return tsFunctions.sum(tsFunctions.extractPeriod(ts,from,to));
};

tsFunctions.sumForYear = function(ts,year){
  return tsFunctions.sum(tsFunctions.extractYear(ts,year));
};

tsFunctions.sumForMonthAndYear = function(ts,month,year){
  return tsFunctions.sum(tsFunctions.extractMonthAndYear(ts,month,year));
};

tsFunctions.cumulativeSum = function(ts){
  var hasEvents = ts.Events!==undefined;
  var events = ts.Events || ts;
  var sum = 0;
  var result = events.map(function(evt){
    sum += evt.Value;
    return {
      Date:evt.Date,
      Value:sum
    };
  });

  if(hasEvents){
    return {
      Events:result
    };
  }
  return result;
};

tsFunctions.NSE = function(modTS,obsTS){
    var intersected = tsFunctions.intersect(modTS,obsTS);
    var mod = intersected[0];
    var obs = intersected[1];
    var delta = v.subtract(obs,mod);

    var numerator = tsFunctions.sum(v.multiply(delta,delta));
    var d = v.subtract(obs,tsFunctions.mean(obs));
    var denominator = tsFunctions.sum(v.multiply(d,d));
    return 1 - numerator/denominator;
};
tsFunctions.NSE.bivariate = true;

(function(){
	v = {};

	v.prefix = '';
	v.suffix = {
    json:'',
    csv:''
  };
	v.img_suffix = '';

	v.data_url = function(resource,format) {
		return v.prefix + resource + v.suffix[format||'json'];
	};

	v.img_url = function(resource) {
		return v.prefix + resource + v.img_suffix;
	};

  v.docUrl = function(resource){
    return v.prefix + resource;
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
    var fields = field.split('.');
    var lastField = fields[fields.length-1];
    var retrieveFrom = function(d,fieldsRemaining){
      if(fieldsRemaining===undefined){
        fieldsRemaining = fields.slice();
      }
      if(fieldsRemaining.length===1){
        return d[fieldsRemaining[0]];
      }
      return retrieveFrom(d[fieldsRemaining[0]],fieldsRemaining.slice(1));
    };

    grouper = grouper || function(rows){return rows;};
    var result = [];
    data.forEach(function(d) {
      var key = retrieveFrom(d);
      var matchingRows = result.filter(function(r){return r[lastField]===key;});
      var theRow;
      if(matchingRows.length===0) {
        theRow = {};
        theRow[lastField] = key;
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

  var initEntry = function(entry){
    var result = {};
    if(entry.date){
      result.date = entry.date;
    } else {
      result.Date = entry.Date;
    }
    return result;
  };

  v.binOp = function(lhs,rhs,op){
    lhs = tsFunctions._events(lhs);
    rhs = tsFunctions._events(rhs);

    var result = [];
    var rhsTS = false;
    if(rhs.length) {
      v.assert(lhs.length === rhs.length);
      rhsTS = true;
    }

    for(var ts in lhs) {
      var lhsE = lhs[ts];
      var rhsE = rhsTS?rhs[ts]:rhs;
      v.assert(!rhsTS || ((lhsE.date||lhsE.Date).getTime()===(rhsE.date||rhsE.Date).getTime()));

      var newE = initEntry(lhsE);
      for(var col in lhsE) {
        if((col==='date')||(col==='Date')){ continue;}

        newE[col] = op(lhsE[col],(rhsTS?rhsE[col]:rhsE));
      }
      result.push(newE);
    }

    return result;
  };

  v.subtract = function(lhs,rhs) {
    return v.binOp(lhs,rhs,function(a,b){return a-b;});
  };

  v.plus = function(lhs,rhs) {
    return v.binOp(lhs,rhs,function(a,b){return a+b;});
  };

  v.multiply = function(lhs,rhs){
    return v.binOp(lhs,rhs,function(a,b){return a*b;});
  };

  v.divide = function(lhs,rhs){
    return v.binOp(lhs,rhs,function(a,b){return a/b;});
  };

  v.array = arrayFunctions;
  v.ts = tsFunctions;

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
      if((col==='date')||(col==='Date')){
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
