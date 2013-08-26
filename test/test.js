var orientdb = require('../index.js');

beforeEach(function(done){
	orientdb.connect({ 'database': 'testtinker', 
					'user': 'root',
					'password': 'FB87B02FCF8634EA5E46D4152211270E83D9416FF3CB9CCC95355364DE6F2C50'})
		.then(function(result){
      		g = result;
  			done();	
      	});
});

describe('Transforms', function(){
  	// describe('id', function() {
   //      it("should return all ids", function(done){
   //          g.V().id().then(function(result){
   //          	console.log(result);
	  //     			result.result.should.have.lengthOf(6);
	  //     			result.result.should.eql([ '#9:12', '#9:13', '#9:14', '#9:15', '#9:16', '#9:17' ]);
	  //     			done();	
	  //     		});
   //      });
   //  }),
	describe('g.V', function(){
		it('should return 6 vertices', function(done){
			g.V()
				.then(function(result){
					result.result.should.have.lengthOf(6);
	      			// result.result[0].should.have.property('name', 'peter');
	      			// result.result[1].should.have.property('name', 'lop');
	      			// result.result[2].should.have.property('name', 'vadas');
	      			// result.result[3].should.have.property('name', 'marko');
	      			// result.result[4].should.have.property('name', 'ripple');
	      			// result.result[5].should.have.property('name', 'josh');					
					done();	
				});
		});
		
		it('should return marko vertex', function(done){
			g.V('name', 'marko')
				.then(function(result){
					result.result.should.have.lengthOf(1);
	      			result.result[0].should.have.property('name', 'marko');
					done();	
				});
		});

	}),
    describe('g.E', function(){
	    it('should return 6 edges', function(done){
	    	g.E()
	      		.then(function(result){
	      			result.result.should.have.lengthOf(6);
	      			done();	
	      		});
    	});


		//	g.E().has('weight', T.gt, 0.5f).outV().transform{[it.id,it.age]}    	
    	it('should return id and age array = [ [ "4", 32 ], [ "1", 29 ] ] ', function(done){
	    	g.E().has('weight', 'T.gt', '0.5f').outV().transform('{[it.id,it.age]}')
	      		.then(function(result){
	      			//console.log(result);
	      			result.result.value.should.have.lengthOf(2);
	      			result.result.value.should.eql([ [ "#9:17", 32 ], [ "#9:15", 29 ] ]);
	      			done();	
	      		});
    	});
  	}),
  	describe('v', function() {
        it("should get id 1", function(done){
            g.v('9:15')
            	.then(function(result){
	      			result.result.should.have.lengthOf(1);
	      			result.result[0].should.have.property('name', 'marko');
					done();	
	      		});
        });

        it("should return id 1 & 4", function(done){
            g.v('9:15', '9:17')
            	.then(function(result){
	      			result.result.should.have.lengthOf(2);
	      			result.result[0].should.have.property('name', 'marko');
	      			result.result[1].should.have.property('name', 'josh')
	      			done();	
	      		});
        });

    }),
    describe('select', function(){
		it('should return vertices with keys x & y', function(done){
			g.v('9:15').as('x').out('knows').as('y').select()
				.then(function(result){
					result.result.should.have.lengthOf(2);
					result.result[0].should.have.keys('x', 'y');
					result.result[1].should.have.keys('x', 'y');
					done();	
				});
		});

		it('should return vertices with key y', function(done){
			g.v('9:15').as('x').out('knows').as('y').select(["y"])
				.then(function(result){
					//console.log(result);
					result.result.should.have.lengthOf(2);
					result.result[0].should.have.keys('y');
					result.result[1].should.have.keys('y');
					done();	
				});
		});

		it('should return object with key y and name', function(done){
			g.v('9:15').as('x').out('knows').as('y').select(["y"],"{it.name}")
				.then(function(result){
					//console.log(result);
					result.result.should.have.lengthOf(2);
					result.result.should.includeEql({ y: 'vadas' });
					result.result.should.includeEql({ y: 'josh' });
					done();	
				});
		});

		it('should return vertices with id and name', function(done){
			g.v('9:15').as('x').out('knows').as('y').select("{it.id}{it.name}")
				.then(function(result){
					//console.log(result);
					result.result.should.have.lengthOf(2);
					result.result[0].should.have.keys('x', 'y');
					result.result[1].should.have.keys('x', 'y');
					done();	
				});
		});
	}),
  	describe('orderMap', function() {
        it("desc order based on relationship count", function(done){
            g.V().both().groupCount().cap().orderMap('T.decr')
            	.then(function(result){
            		//console.log(result);
	      			result.result.should.have.lengthOf(6);
	      			result.result[0].should.have.property('name', 'lop');
	      			result.result[1].should.have.property('name', 'marko');
	      			result.result[2].should.have.property('name', 'josh');
	      			result.result[3].should.have.property('name', 'peter');
	      			result.result[4].should.have.property('name', 'vadas');
	      			result.result[5].should.have.property('name', 'ripple');	
	      			done();	
	      		});
        });
    })
});

describe('Filters', function(){
	describe('g.V', function(){
		it('should return value = peter', function(done){
			g.V().index(0).property('name')
				.then(function(result){
					//console.log(result);
					result.result[0].should.have.property('value', 'peter');
					done();	
				});
		});

		it('should return name = peter && lop', function(done){
			g.V().range('0..<2').property('name')
				.then(function(result){
					//console.log(JSON.stringify(result));
					result.result[0].value.should.have.lengthOf(2);
	      			result.result[0].value.should.eql(['peter', 'lop']);
					done();	
				});
		});
	}),

	describe('and', function(){
		it('should return marko & josh', function(done){
			g.V().and(g._().both("knows"), g._().both("created"))
				.then(function(result){
					console.log(JSON.stringify(result));
	      			result.result.should.have.lengthOf(2);
	      			result.result[0].should.have.property('name', 'marko');
	      			result.result[1].should.have.property('name', 'josh');
					done();	
				});
		});
	}),
	describe('or', function(){
		it('should return edges id 7 & 9', function(done){
			g.v(1).outE().or(g._().has('id', 'T.eq', 9), g._().has('weight', 'T.lt', '0.6f'))
				.then(function(result){
					//console.log(result);
	      			result.results.should.have.lengthOf(2);
	      			result.results.should.includeEql({ weight: 0.5,
												       _id: '7',
												       _type: 'edge',
												       _outV: '1',
												       _inV: '2',
												       _label: 'knows' });
	      			result.results.should.includeEql({ weight: 0.4,
												       _id: '9',
												       _type: 'edge',
												       _outV: '1',
												       _inV: '3',
												       _label: 'created' });
					done();	
				});
		});
	}),
	describe('retain', function(){
		it('should return vertices with id 13,14,15', function(done){
			g.V().retain([g.v('9:15'), g.v('9:14'), g.v('9:13')])
				.then(function(result){
					//console.log(result);
	      			result.result.should.have.lengthOf(3);
	      			result.result[0].should.have.property('name', 'lop');
	      			result.result[1].should.have.property('name', 'vadas');
	      			result.result[2].should.have.property('name', 'marko');
	      			done();	
				});
		});
	}),
	describe('except', function(){
		it('should return vertices josh & peter', function(done){
			g.V().has('age','T.lt',30).as('x').out('created').in('created').except('x')
				.then(function(result){
					console.log(result);
	      			result.result.should.have.lengthOf(2);
	      			result.result[0].should.have.property('name', 'peter');
	      			result.result[1].should.have.property('name', 'josh');
					done();	
				});
		});
	})
});

describe('Side Effects', function(){
	describe('gather', function() {
        it("should get 3", function(done){
            g.v('9:15').out().gather("{it.size()}")
            	.then(function(result){
	      			result.result.should.have.lengthOf(1);
	      			result.result[0].value.should.eql(3);
	      			done();	
	      		});
        });
    })
});

describe('Branch', function(){
	describe('copySplit', function() {
        it("should get [ 'ripple', 27, 'lop', 32 ]", function(done){
            g.v(1).out('knows').copySplit(g._().out('created').property('name'), g._().property('age')).fairMerge()
            	.then(function(result){
            		console.log(result);
            		result.result.should.have.lengthOf(4);
	      			result.result[0].value.should.eql([ 'ripple', 27, 'lop', 32 ]);
	      			done();	
	      		});
        });
    }),
    describe('ifThenElse', function() {
        it("should get [ 'vadas', 32, 'lop' ]", function(done){
            g.v(1).out().ifThenElse("{it.name=='josh'}{it.age}{it.name}")
            	.then(function(result){
            		//console.log(result);
            		result.result.should.have.lengthOf(3);
	      			result.result[0].value.should.eql([ 'vadas', 32, 'lop' ]);
	      			done();	
	      		});
        });
    })
});


describe('Methods', function(){
	describe('indexing', function() {
        it("should create index 'my-index'", function(done){
            g.createIndex("my-index", 'Vertex.class')
            	.then(function(result){
            		//console.log(result);
	      			result.success.should.eql(true);
	      			done();	
	      		});
        });
        
        it("should add name => marko to index 'my-index'", function(done){
            g.idx("my-index").put("name", "marko", g.v(1))
            	.then(function(result){
            		//console.log(result);
	      			result.success.should.eql(true);
	      			done();	
	      		});
        });
        it("should retrieve indexed value marko from 'my-index'", function(done){
            g.idx("my-index", {'name':'marko'})
            	.then(function(result){
            		//console.log(result);
	      			result.success.should.eql(true);
	      			result.results.should.includeEql({ name: 'marko', age: 29, _id: '1', _type: 'vertex' });
	      			done();	
	      		});
        });
        it("should drop index 'my-index'", function(done){
            g.dropIndex("my-index")
            	.then(function(result){
            		//console.log(result);
	      			result.success.should.eql(true);
	      			done();	
	      		});
        });
    }),
	describe('keys', function() {
        it("should return name & age keys", function(done){
            g.v('9:15').keys()
            	.then(function(result){
            		//console.log(result);
	      			result.result[0].value.should.have.lengthOf(2);
	      			result.result[0].value.should.eql([ 'age', 'name' ]);
	      			done();	
	      		});
        });
    }),
	describe('values', function() {
        it("should return marko & 29 values", function(done){
            g.v('9:15').values()
            	.then(function(result){
            		//console.log(result);
	      			result.result[0].value.should.have.lengthOf(2);
	      			result.result[0].value.should.eql([ 29, 'marko' ]);
	      			done();	
	      		});
        });
    })
});

describe('Misc', function(){
	describe('float', function() {
        it("should return weight", function(done){
            g.v('9:15').outE().has("weight", "T.gte", "0.5f").property("weight")
            	.then(function(result){
            		//console.log(result);
            		result.result[0].value.should.have.lengthOf(2);
	      			result.result[0].value.should.eql([ 0.5, 1 ]);
	      			done();	
	      		});
        });
    })
});

