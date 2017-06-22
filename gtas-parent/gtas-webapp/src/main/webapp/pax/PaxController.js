/*
 * All GTAS code is Copyright 2016, The Department of Homeland Security (DHS), U.S. Customs and Border Protection (CBP).
 * 
 * Please see LICENSE.txt for details.
 */
(function () {
    'use strict';
    app.controller('PassengerDetailCtrl', function ($scope, $mdDialog, passenger, $mdToast, spinnerService, user, ruleHits, paxDetailService, caseService, watchListService, codeTooltipService) {
        $scope.passenger = passenger.data;
        $scope.isLoadingFlightHistory = true;        
        $scope.isClosedCase = false;
        $scope.ruleHits = ruleHits;
        
        //Bandaid: Parses out seat arrangements not for the particular PNR, returns new seat array. This should be handled on the back-end.
        var parseOutExtraSeats = function(seats, flightLegs){
        	var newSeats = [];
        	$.each(seats, function(index,value){
        		$.each(flightLegs, function(i,v){
        			if(value.flightNumber === v.flightNumber){
        				newSeats.push(value);
        				return;
        			}
        		});
        	});
        	return newSeats;
        };
        
        //Bandaid: Re-orders TVL lines for flight legs, making sure it is ordered by date.
        var reorderTVLdata = function(flightLegs){
        	var orderedTvlData = [];
        	
        	//Sorts flightLeg objects based on etd
        	flightLegs.sort(function(a,b){
        		if(a.etd < b.etd) return -1;
        		if(a.etd > b.etd) return 1;
        		else return 0;
        	});
        	//sets each flightLeg# to the newly sorted index value
        	$.each(flightLegs, function(index,value){
        		value.legNumber = index+1; //+1 because 0th flight leg doesn't read well to normal humans
        	});
        	
        	orderedTvlData = flightLegs;
        	
        	return orderedTvlData
        };
        
        if(angular.isDefined($scope.passenger.pnrVo) && $scope.passenger.pnrVo != null){
        	$scope.passenger.pnrVo.seatAssignments = parseOutExtraSeats($scope.passenger.pnrVo.seatAssignments, $scope.passenger.pnrVo.flightLegs);
        	$scope.passenger.pnrVo.flightLegs = reorderTVLdata($scope.passenger.pnrVo.flightLegs);
    	}
        
        //Removes extraneous characters from rule hit descriptions
        if($scope.ruleHits != typeof 'undefined' && $scope.ruleHits != null && $scope.ruleHits.length > 0){
        	$.each($scope.ruleHits[0].hitsDetailsList, function(index,value){
        		value.ruleConditions = value.ruleConditions.replace(/[.*+?^${}()|[\]\\]/g, '');
        	});
    	}        
       
        $scope.getCodeTooltipData = function(field,type){
        	return codeTooltipService.getCodeTooltipData(field,type);
        };
        
        $scope.saveDisposition = function(){
        	var disposition = {
                    'passengerId':$scope.passenger.paxId,
                    'flightId':$scope.passenger.flightId,
                    'statusId':$scope.currentDispStatus,
                    'comments':$scope.currentDispComments,
                    'user':user.data.userId,
                    'createdBy': user.data.userId,
                    'createdAt': new Date()
                };

        	spinnerService.show('html5spinner');
        	caseService.createDisposition(disposition)
        	.then(function(response){
        		spinnerService.hide('html5spinner');
        		//Clear input, reload history
        		$scope.currentDispStatus="-1";
        		$scope.currentDispComments="";
        		//This makes it palatable to the front-end
        		$.each($scope.dispositionStatus, function(index,value){
        			if(value.id === parseInt(disposition.statusId)){
        				var status = {status:value.name};
        				$.extend(disposition,status);
        			}
        		});
        		if($scope.passenger.dispositionHistory != null && typeof $scope.passenger.dispositionHistory.length != "undefined"
        			&& response.data.status.toUpperCase() === "SUCCESS"){
        			//Add to disposition length without service calling if success
        			$scope.passenger.dispositionHistory.push(disposition);
        		} else{
        			$scope.passenger.dispositionHistory = [disposition];
        		}
        	});
        }  
        
     var getMostRecentCase = function(dispHistory){
    	var mostRecentCase = null;
     	$.each(dispHistory, function(index,value){
     		if(mostRecentCase === null || mostRecentCase.createdAt < value.createdAt){
     			mostRecentCase = value;
     		}
     	});
     	return mostRecentCase;
     }   

       $scope.isCaseDisabled = function(dispHistory){
    	 
    	 //Find if most recent case is closed
        	var mostRecentCase = getMostRecentCase(dispHistory);
         //If Closed, find out if current user is Admin
        	if(mostRecentCase != null && mostRecentCase.statusId == 3){
        	  	var isAdmin = false;
            	$.each(user.data.roles,function(index,value){
            		if(value.roleId === 1){
            			isAdmin = true;
            		}
            	});
         //If user is admin do not disable, else disable
        		if(isAdmin){
        			return false;
        		} else return true;
        	} else return false; //if not closed do not disable
        };
       	
       	$scope.isCaseDropdownItemDisabled = function(statusId){
       		var mostRecentCase = getMostRecentCase($scope.passenger.dispositionHistory);
       		if(mostRecentCase != null){
       			if(mostRecentCase.statusId == 1){
       				if(statusId == 3 || statusId == 4 || statusId == 1){
       					return true;
       				}
       			}else if(mostRecentCase.statusId == 2){
	       			if(statusId == 3 || statusId == 4 || statusId == 1){
	       				return true;
	       			}
	       		}else if(mostRecentCase.statusId == 3){
	       			if(statusId != 4){
	       				return true;
	       			}
	       		}else if(mostRecentCase.statusId == 4){
	       			 if(statusId == 2 || statusId == 3 || statusId == 1){
	       				 return true;
	       			 }
	       		}else if(mostRecentCase.statusId == 5){
	       			if(statusId == 2 || statusId == 1){
	       				return true;
	       			}
	       		} else if(mostRecentCase.statusId > 5){
	       			if(statusId == 1 || statusId == 3){
	       				return true
	       			}
	       		}
       			return false;
       		} if(statusId == 1){
       			return false;
       		} else{ return true;}
       	};
       	
        caseService.getDispositionStatuses()
        .then(function(response){
        	$scope.dispositionStatus = response.data;
        });
        
        paxDetailService.getPaxFlightHistory($scope.passenger.paxId)
        .then(function(response){
        	$scope.getPaxFullTravelHistory($scope.passenger);
            $scope.passenger.flightHistoryVo = response.data;
        });
        
        $scope.getPaxFullTravelHistory= function(passenger){
        	var doc = passenger.documents[0];
        	if(typeof doc != 'undefined' && doc.documentNumber.length > 0){
        		var docNum = doc.documentNumber;
        		var docExp = doc.expirationDate;
        		var docIssuCountry = doc.issuanceCountry;
        		paxDetailService.getPaxFullTravelHistory(passenger.paxId, docNum, docIssuCountry, docExp).then(function(response){
        			$scope.passenger.fullFlightHistoryVo ={'map': response.data};
        			$scope.passenger.flightHistoryVo.flightHistoryMap = parseDuplicateDocumentFlights($scope.passenger.flightHistoryVo.flightHistoryMap); //Remove duplicates amongst the documents        			
        			for(var arry in $scope.passenger.flightHistoryVo.flightHistoryMap){
        				$scope.passenger.fullFlightHistoryVo.map = parseOutDuplicateFlights($scope.passenger.fullFlightHistoryVo.map, $scope.passenger.flightHistoryVo.flightHistoryMap[arry])
        			}
        			$scope.isLoadingFlightHistory = false;
        		});
        	} else{
        		console.log("doc  was undefined, halting full travel history call");
        		$scope.isLoadingFlightHistory = false;
        	}
        };
    var parseOutDuplicateFlights = function(currentPNRFlightArray, totalFlightArray){
    	var duplicateIndexes = []; 
    	var duplicateFreeFlightArray = [];
    	$.each(currentPNRFlightArray, function(index,value){
    		if(angular.isDefined(value) && value != null){
	    		$.each(totalFlightArray, function(i,v){
	    			if(angular.isDefined(v) && v != null){
		    			if(value.id === v.id){
		    				if(duplicateIndexes.indexOf(index) === -1){
		    					duplicateIndexes.push(index);
		    				}
		    				return;
		    			};
	    			}
	    		});
    		}
    	});
    	
    	
    	$.each(currentPNRFlightArray, function(i,v){
    		var notDupe = true;
    		$.each(duplicateIndexes, function(index,value){
    			if(value === i){
    				notDupe = false;
    				return;
    			}
    		});
    		if(notDupe){
    			duplicateFreeFlightArray.push(v);
    		}
    	});
    	
    	//Bandaid: Re-order TVL lines so that dates are in correct order for all duplicateFreeArrays
    	duplicateFreeFlightArray = reorderTVLdata(duplicateFreeFlightArray);
    	
    	return duplicateFreeFlightArray;
    }
    //Multiple documents on the same PNR pull and show the same flights on the flight history tab
    //This function will remove all duplicate flights from a given Map, remove all documents that have 0 flights, and return a new fully parsed map
    var parseDuplicateDocumentFlights = function(flightHistoryMap){
    	var longest = 0;
		var longestIndex = -1;
		//Insure we maintain the largest amount of flight information by defining a psuedo 'primary' doc
    	$.each(flightHistoryMap, function(index,value){
    		if(value.length > longest){
    			longest = value.length;
    			longestIndex = index;    
    		};
    	});
    	//Remove duplicates from all non-primary documents
    	$.each(flightHistoryMap, function(index,value){
    		if(index != longestIndex){
    			flightHistoryMap[index] = parseOutDuplicateFlights(value, flightHistoryMap[longestIndex]);
    		}		       	
        	
    		//Bandaid: Sometimes flighthistory and the pnr flight legs do not match, this compares and parses them out if they do not exist in the pnrVo.flightLegs object arry
        	flightHistoryMap[index] = parseOutNonMatchingFlightHistoryToPNRFlights(flightHistoryMap[index], $scope.passenger.pnrVo.flightLegs);
        	
        	//Bandaid: Re-order TVL lines so that dates are in correct order based on etd
        	flightHistoryMap[index] = reorderTVLdata(flightHistoryMap[index]);    		
    	});
    	
    	
    	
    	//Remove documents with no flights now
    	var fullyParsedMap = {};
    	$.each(flightHistoryMap, function(index,value){
    		if(value.length != 0){
    			fullyParsedMap[index] = value;
    		}
    	});
    	
    	return fullyParsedMap;
    }
    
    //PNR flight legs were not matching with flight history, 
    //this will compare the lists and remove from flight history flights that do not appear in the list under the PNR flightlegs
    var parseOutNonMatchingFlightHistoryToPNRFlights = function(flightHistoryFlightsArry, PNRFlightsArry){
    	if(!angular.isDefined(flightHistoryFlightsArry) || flightHistoryFlightsArry == null || !angular.isDefined(PNRFlightsArry) || PNRFlightsArry == null){
    		return;
    	}
    	
    	var parsedFlightHistory = [];
    	$.each(PNRFlightsArry, function(index,value){
    		$.each(flightHistoryFlightsArry, function(i,v){
    			if(v.fullFlightNumber === value.flightNumber){ //If flighthistory has flight that is in pnr leg, set aside in new verified array
    				parsedFlightHistory.push(v);
    			}
    		});
    	});
    	return parsedFlightHistory;
    }
    
    //Adds user from pax detail page to watchlist.
    $scope.addEntityToWatchlist = function(){
    	spinnerService.show('html5spinner');
    	var terms = [];
    	//Add passenger firstName, lastName, dob to wlservice call
   		terms.push({entity: "PASSENGER", field: "firstName", type: "string", value: $scope.passenger.firstName});
   		terms.push({entity: "PASSENGER", field: "lastName", type: "string", value: $scope.passenger.lastName});
   		terms.push({entity: "PASSENGER", field: "dob", type: "date", value: $scope.passenger.dob});
   		watchListService.addItem("Passenger", "PASSENGER", null, terms).then(function(){
   			terms = [];
   	    	//Add documentType and documentNumber to wlservice call
   			$.each($scope.passenger.documents, function(index,value){
   	    		if(value.documentType === "P" || value.documentType === "V"){
   	    			terms.push({entity: "DOCUMENT", field: "documentType", type: "string", value: value.documentType});
   	        		terms.push({entity: "DOCUMENT", field: "documentNumber", type: "string", value: value.documentNumber});
   	   	    		watchListService.addItem("Document", "DOCUMENT", null, terms).then(function(response){
   	   	    			//Compiles after each document add.
   	   	    			watchListService.compile();
   	   	    			//clear out terms list
   	   	    			terms = [];
   	   	    			spinnerService.hide('html5spinner');
   	   	    		});
   	   			}
   	   		});
   		});
    };
    
    $scope.showConfirm = function () {
        var confirm = $mdDialog.confirm()
            .title('WARNING: Please Confirm The Watchlist Addition')
            .textContent('This will add both the current passenger and their applicable documents to the watchlist.')
            .ariaLabel('Add To Watchlist Warning')
            .ok('Confirm Addition')
            .cancel('Cancel');

        $mdDialog.show(confirm).then(function () {
            $scope.addEntityToWatchlist();
        }, function () {
            return false;
        });
    };
    
    });
    app.controller('PaxController', function ($scope, $injector, $stateParams, $state, $mdToast, paxService, sharedPaxData, uiGridConstants, gridService,
                                              jqueryQueryBuilderService, jqueryQueryBuilderWidget, executeQueryService, passengers,
                                              $timeout, paxModel, $http, codeTooltipService, spinnerService) {
        $scope.errorToast = function(error){
            $mdToast.show($mdToast.simple()
             .content(error)
             .position('top right')
             .hideDelay(4000)
             .parent($scope.toastParent));
        };
        
        var exporter = {
                'csv': function () {
                    $scope.gridApi.exporter.csvExport('all', 'all');
                }
        };
        
        $scope.export = function (format) {
            exporter[format]();
        };
        
        function createFilterFor(query) {
            var lowercaseQuery = query.toLowerCase();
            return function filterFn(contact) {
                return (contact.lowerCasedName.indexOf(lowercaseQuery) >= 0);
            };
        }
        /* Search for airports. */
        function querySearch(query) {
            var results = query && (query.length) && (query.length >= 3) ? self.allAirports.filter(createFilterFor(query)) : [];
            return results;
        }

        $scope.searchSort = querySearch;
        $scope.model = paxModel.model;

        var self = this, airports,
            stateName = $state.$current.self.name,
            ruleGridColumns = [{
                name: 'ruleTitle',
                displayName: 'Title',
                cellTemplate: '<md-button aria-label="title" class="md-primary md-button md-default-theme" ng-click="grid.appScope.ruleIdClick(row)">{{COL_FIELD}}</md-button>'
            }, {
                name: 'ruleConditions',
                displayName: 'Conditions',
                field: 'hitsDetailsList[0]',
                cellFilter: 'hitsConditionDisplayFilter'
            }],
            setSubGridOptions = function (data, appScopeProvider) {
                data.passengers.forEach(function (entity_row) {
                    if (!entity_row.flightId) {
                        entity_row.flightId = $stateParams.id;
                    }
                    entity_row.subGridOptions = {
                        appScopeProvider: appScopeProvider,
                        columnDefs: ruleGridColumns,
                        data: []
                    };
                });
            },
            setPassengersGrid = function (grid, response) {
                //NEEDED because java services responses not standardize should have Lola change and Amit revert to what he had;
                var data = stateName === 'queryPassengers' ? response.data.result : response.data;
                setSubGridOptions(data, $scope);
                grid.totalItems = data.totalPassengers === -1 ? 0 : data.totalPassengers;
                grid.data = data.passengers;
                if(!grid.data || grid.data.length == 0){
                    $scope.errorToast('No results found for selected filter criteria');
                }
                spinnerService.hide('html5spinner');
            },
            getPage = function () {
                if(stateName === "queryPassengers"){
                    setPassengersGrid($scope.passengerQueryGrid, passengers);
                }else{
                    setPassengersGrid($scope.passengerGrid, passengers);
                }
            },
            update = function (data) {
                passengers = data;
                getPage();
                spinnerService.hide('html5spinner');
            },
            fetchMethods = {
                'queryPassengers': function () {
                    var postData, query = JSON.parse(localStorage['query']);
                    postData = {
                        pageNumber: $scope.model.pageNumber,
                        pageSize: $scope.model.pageSize,
                        query: query
                    };
                    spinnerService.show('html5spinner');
                    executeQueryService.queryPassengers(postData).then(update);
                },
                'flightpax': function () {
                    spinnerService.show('html5spinner');
                    paxService.getPax($stateParams.id, $scope.model).then(update);
                },
                'paxAll': function () {
                    spinnerService.show('html5spinner');
                    paxService.getAllPax($scope.model).then(update);
                }
            },
            resolvePage = function () {
                populateAirports();
                fetchMethods[stateName]();
            },
            flightDirections = [
                {label: 'Inbound', value: 'I'},
                {label: 'Outbound', value: 'O'},
                {label: 'Any', value: 'A'}
            ];

        self.querySearch = querySearch;
        $http.get('data/airports.json')
            .then(function (allAirports) {
                airports = allAirports.data;
                self.allAirports = allAirports.data.map(function (contact) {
                    //contact.lowerCasedName = contact.name.toLowerCase();
                    contact.lowerCasedName = contact.id.toLowerCase();
                    return contact;
                });
                self.filterSelected = true;
                $scope.filterSelected = true;
            });
        $scope.flightDirections = flightDirections;

        $injector.invoke(jqueryQueryBuilderWidget, this, {$scope: $scope});
        $scope.stateName = $state.$current.self.name;
        $scope.ruleIdClick = function (row) {
            $scope.getRuleObject(row.entity.ruleId);
        };

        $scope.getRuleObject = function (ruleID) {
            jqueryQueryBuilderService.loadRuleById('rule', ruleID).then(function (myData) {
                $scope.$builder.queryBuilder('readOnlyRules', myData.result.details);
                $scope.hitDetailDisplay = myData.result.summary.title;
                document.getElementById("QBModal").style.display = "block";

                $scope.closeDialog = function () {
                    document.getElementById("QBModal").style.display = "none";
                };
            });
        };

        $scope.isExpanded = true;
        $scope.paxHitList = [];
        $scope.list = sharedPaxData.list;
        $scope.add = sharedPaxData.add;
        $scope.getAll = sharedPaxData.getAll;

        $scope.getPaxSpecificList = function (index) {
            return $scope.list(index);
        };

        $scope.buildAfterEntitiesLoaded();
        
        $scope.passengerGrid = {
                paginationPageSizes: [10, 15, 25],
                paginationPageSize: $scope.model.pageSize,
                paginationCurrentPage: $scope.model.pageNumber,
                useExternalPagination: true,
                useExternalSorting: true,
                useExternalFiltering: true,
                enableHorizontalScrollbar: 0,
                enableVerticalScrollbar: 0,
                enableColumnMenus: false,
                multiSelect: false,
                enableExpandableRowHeader: false,
                expandableRowTemplate: '<div ui-grid="row.entity.subGridOptions"></div>',

                onRegisterApi: function (gridApi) {
                    $scope.gridApi = gridApi;

                    gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                        $scope.model.pageNumber = newPage;
                        $scope.model.pageSize = pageSize;
                        resolvePage();
                    });

                    gridApi.core.on.sortChanged($scope, function (grid, sortColumns) {
                        if (sortColumns.length === 0) {
                            $scope.model.sort = null;
                        } else {
                            $scope.model.sort = [];
                            for (var i = 0; i < sortColumns.length; i++) {
                                $scope.model.sort.push({column: sortColumns[i].name, dir: sortColumns[i].sort.direction});
                            }
                        }
                        resolvePage();
                    });

                    gridApi.expandable.on.rowExpandedStateChanged($scope, function (row) {
                        if (row.isExpanded) {
                            paxService.getRuleHits(row.entity.id).then(function (data) {
                                row.entity.subGridOptions.data = data;
                            });
                        }
                    });
                }
            };
        //Front-end pagination configuration object for gridUi
        //Should only be active on stateName === 'queryPassengers'
        $scope.passengerQueryGrid = {
            paginationPageSizes: [10, 15, 25],
            paginationPageSize: $scope.model.pageSize,
            paginationCurrentPage: 1,
            useExternalPagination: false,
            useExternalSorting: false,
            useExternalFiltering: false,
            enableHorizontalScrollbar: 0,
            enableVerticalScrollbar: 0,
            enableColumnMenus: false,
            multiSelect: false,
            enableExpandableRowHeader: false,
            minRowsToShow: 10,
            expandableRowTemplate: '<div ui-grid="row.entity.subGridOptions"></div>',

            onRegisterApi: function (gridApi) {
                $scope.gridApi = gridApi;
                
                gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                    $scope.model.pageSize = pageSize;
                });
                
                gridApi.expandable.on.rowExpandedStateChanged($scope, function (row) {
                    if (row.isExpanded) {
                        paxService.getRuleHits(row.entity.id).then(function (data) {
                            row.entity.subGridOptions.data = data;
                        });
                    }
                });
            }    
        };
        
        $scope.getCodeTooltipData = function(field, type){
        	return codeTooltipService.getCodeTooltipData(field,type);
        }
        
      	$scope.hitTooltipData = ['Loading...'];
        
        $scope.resetTooltip = function(){
        	$scope.hitTooltipData = ['Loading...'];
        	$('md-tooltip').remove();
        };
        
    	$scope.getHitTooltipData = function(row){
    		var dataList = [];
    		paxService.getRuleHits(row.entity.id).then(function (data){
    			$.each(data,function(index,value){
    				dataList.push(value.ruleDesc);
    			});
    			if(dataList.length === 0){
    				dataList = "No Description Available";
    			}
    			$scope.hitTooltipData = dataList;
    		});
    	};
        
        if (stateName === 'queryPassengers') {
            $scope.passengerQueryGrid.columnDefs = [
                {
                    field: 'onRuleHitList',
                    name: 'onRuleHitList',
                    displayName: 'Rule Hits',
                    width: 90,
                    cellClass: "rule-hit",
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 0
                    },
                    cellTemplate: '<md-button aria-label="hits" ng-mouseover="grid.appScope.getHitTooltipData(row)" ng-mouseleave="grid.appScope.resetTooltip()" ng-click="grid.api.expandable.toggleRowExpansion(row.entity)" disabled="{{row.entity.onRuleHitList|ruleHitButton}}">'
                    	+'<md-tooltip class="tt-multiline" md-direction="right"><div ng-repeat="item in grid.appScope.hitTooltipData">{{item}}<br/></div></md-tooltip>'
                    	+'<i class="{{row.entity.onRuleHitList|ruleHitIcon}}"></i></md-button>'
                },
                {
                    name: 'onWatchList', displayName: 'Watchlist Hits', width: 130,
                    cellClass: gridService.anyWatchlistHit,
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 1
                    },
                    cellTemplate: '<div><i class="{{row.entity.onWatchList|watchListHit}}"></i> <i class="{{row.entity.onWatchListDoc|watchListDocHit}}"></i></div>'
                },
                {
                    field: 'passengerType',
                    name: 'passengerType',
                    displayName:'T',
                    width: 50},
                {
                    field: 'lastName',
                    name: 'lastName',
                    displayName:'pass.lastname', headerCellFilter: 'translate',
                    cellTemplate: '<md-button aria-label="type" href="#/paxdetail/{{row.entity.id}}/{{row.entity.flightId}}" title="Launch Flight Passengers in new window" target="pax.detail.{{row.entity.id}}.{{row.entity.flightId}}" class="md-primary md-button md-default-theme">{{COL_FIELD}}</md-button>'
                },
                {
                    field: 'firstName',
                    name: 'firstName',
                    displayName:'pass.firstname', headerCellFilter: 'translate'},
                {
                    field: 'middleName',
                    name: 'middleName',
                    displayName:'pass.middlename', headerCellFilter: 'translate'
                },
                {
                	field: 'documents[0].documentNumber',
                	name:'documentNumber',
                	displayName:'pass.docNum', headerCellFilter: 'translate'
                },
                {
                    field: 'flightNumber',
                    name: 'flightNumber',
                    displayName:'pass.flight', headerCellFilter: 'translate',
                    cellTemplate: '<div>{{row.entity.carrier}}{{COL_FIELD}}</div>'
                },
                {
                    field: 'flightOrigin',
                    name: 'flightOriginairport',
                    displayName:'pass.originairport', headerCellFilter: 'translate'
                },
                {
                    field: 'flightDestination',
                    name: 'flightDestinationairport',
                    displayName:'pass.destinationairport', headerCellFilter: 'translate'
                },
                {
                    field: 'etaLocalTZ',
                    name: 'etaLocalTZ',
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 2
                    },
                    displayName:'pass.eta', headerCellFilter: 'translate'
                },
                {
                    field: 'etdLocalTZ',
                    name: 'etdLocalTZ',
                    displayName:'pass.etd', headerCellFilter: 'translate'
                },
                {
                    field: 'gender',
                    name: 'gender',
                    displayName:'G',
                    width: 50},
                {
                    name: 'dob',
                    displayName:'pass.dob', headerCellFilter: 'translate',
                    cellFilter: 'date'
                },
                {
                    name: 'citizenshipCountry',
                    displayName:'pass.citizenship', headerCellFilter: 'translate',
                    width: 75,
                    cellTemplate: '<md-button aria-label="hits" ng-mouseleave="grid.appScope.resetTooltip()">'
                    	+'<md-tooltip class="tt-multiline" md-direction="left"><div>{{grid.appScope.getCodeTooltipData(COL_FIELD,"country")}}</div></md-tooltip>{{COL_FIELD}}'
                    	+'</md-button>'
                }
            ];
        } else {
            $scope.passengerGrid.columnDefs = [
                {
                    name: 'onRuleHitList', displayName: 'Rule Hits', width: 90,
                    cellClass: "rule-hit",
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 0
                    },
                    cellTemplate: '<md-button aria-label="hits" ng-mouseover="grid.appScope.getHitTooltipData(row)" ng-mouseleave="grid.appScope.resetTooltip()" ng-click="grid.api.expandable.toggleRowExpansion(row.entity)" disabled="{{row.entity.onRuleHitList|ruleHitButton}}">'
                	+'<md-tooltip class="tt-multiline" md-direction="right"><div ng-repeat="item in grid.appScope.hitTooltipData">{{item}}<br/></div></md-tooltip>'
                	+'<i class="{{row.entity.onRuleHitList|ruleHitIcon}}"></i></md-button>'
                },
                {
                    name: 'onWatchList', displayName: 'Watchlist Hits', width: 130,
                    cellClass: gridService.anyWatchlistHit,
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 1
                    },
                    cellTemplate: '<div><i class="{{row.entity.onWatchList|watchListHit}}"></i> <i class="{{row.entity.onWatchListDoc|watchListDocHit}}"></i></div>'
                },
                {name: 'passengerType', displayName:'T', width: 50},
                {
                    name: 'lastName', displayName:'pass.lastname', headerCellFilter: 'translate',
                    cellTemplate: '<md-button aria-label="type" href="#/paxdetail/{{row.entity.id}}/{{row.entity.flightId}}" title="Launch Flight Passengers in new window" target="pax.detail" class="md-primary md-button md-default-theme">{{COL_FIELD}}</md-button>'
                },
                {name: 'firstName', displayName:'pass.firstname', headerCellFilter: 'translate'},
                {name: 'middleName', displayName:'pass.middlename', headerCellFilter: 'translate'},
                {
                	field: 'documents[0].documentNumber',
                	name:'documentNumber',
                	displayName:'pass.docNum', headerCellFilter: 'translate'
                },
                {name: 'fullFlightNumber', displayName:'pass.flight', headerCellFilter: 'translate' },
                {
                    name: 'eta',
                    sort: {
                        direction: uiGridConstants.DESC,
                        priority: 2
                    },
                    displayName:'pass.eta', headerCellFilter: 'translate',
                    visible: (stateName === 'paxAll')
                },
                {name: 'etd', displayName:'pass.etd', headerCellFilter: 'translate', visible: (stateName === 'paxAll')},
                {name: 'gender', displayName:'G', width: 50},
                {name: 'dob', displayName:'pass.dob', headerCellFilter: 'translate', cellFilter: 'date'},
                {name: 'citizenshipCountry', displayName:'pass.citizenship', headerCellFilter: 'translate', width: 75, 
                	cellTemplate: '<md-button aria-label="hits" ng-mouseleave="grid.appScope.resetTooltip()">'
                	+'<md-tooltip class="tt-multiline" md-direction="left"><div>{{grid.appScope.getCodeTooltipData(COL_FIELD,"country")}}</div></md-tooltip>{{COL_FIELD}}'
                	+'</md-button>'}
            ];
        }

        var populateAirports = function(){

            var originAirports = new Array();
            var destinationAirports = new Array();

            angular.forEach($scope.model.origin,function(value,index){
                originAirports.push(value.id);
            })

            angular.forEach($scope.model.dest,function(value,index){
                destinationAirports.push(value.id);
            })

            $scope.model.originAirports = originAirports;
            $scope.model.destinationAirports = destinationAirports;
        };

        var mapAirports = function(){

            var originAirports = new Array();
            var destinationAirports = new Array();
            var airport = { id: "" };
            
            if($scope.model.origin ) {
                if ($scope.model.origin instanceof Array ){
                    angular.forEach($scope.model.origin, function (value, index) {
                        if(value instanceof Object) {
                            originAirports.push({id:value.id});
                        }else{
                            originAirports.push({id: value});
                        }
                    });
                }else{
                    originAirports.push({id: $scope.model.origin});
                }
                $scope.model.origin = originAirports;
            }
            
            if($scope.model.dest ) {
                if ($scope.model.dest instanceof Array ) {
                  angular.forEach($scope.model.dest, function (value, index) {
                    if(value instanceof Object) {
                        destinationAirports.push({id:value.id});
                    }else{
                      destinationAirports.push({id: value});
                    }
                  });
                }else{
                    destinationAirports.push({id: $scope.model.dest});
                }
                $scope.model.dest = destinationAirports;   
            }
            
        };

        $scope.filter = function () {
            resolvePage();
            if($scope.gridApi.pagination.getPage() > 1){
                $scope.gridApi.pagination.seek(1);
            }
        };

        $scope.reset = function () {
            paxModel.reset();
            resolvePage();
        };

        $scope.getTableHeight = function () {
            if( stateName != "queryPassengers"){
                return gridService.calculateGridHeight($scope.passengerGrid.data.length);
            } // Sets minimal height for front-end pagination controlled variant of grid
            return gridService.calculateGridHeight($scope.model.pageSize);
        };

        getPage();
        mapAirports();
    });
}());
