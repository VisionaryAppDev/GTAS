/*
 * All GTAS code is Copyright 2016, The Department of Homeland Security (DHS), U.S. Customs and Border Protection (CBP).
 *
 * Please see LICENSE.txt for details.
 */
(function () {
    'use strict';
    app.controller('BlackListController', function ($scope, gridOptionsLookupService, $http, $q, watchListService, $mdSidenav, $interval, spinnerService, $timeout, $mdDialog, $sce) {
        console.log("TRACKING 1:: ");
    	var watchlist = {};
        var tabs = [];
        var model = {
            Passenger: function (entity) {
                this.id = entity ? entity.id : null;
                this.firstName = entity ? entity.firstName : null;
                this.lastName = entity ? entity.lastName : null;
                this.country = entity ? entity.country : undefined;
            }
    	};
        
        console.log("TRACKING 2:: ");
        $scope.model = {};
        $scope.watchlistGrid = gridOptionsLookupService.getGridOptions('blacklist');
        
        
        console.log("TRACKING 3:: ");
        $scope.watchlistGrid.paginationPageSizes = [10, 15, 25];
        $scope.watchlistGrid.paginationPageSize =  $scope.model.pageSize;
        $scope.watchlistGrid.paginationCurrentPage =  $scope.model.pageNumber;
        
        
        console.log("TRACKING 4:: ");
        $scope.watchlistGrid.onRegisterApi = function (gridApi) {
        	console.log("TRACKING 14:: ");
            $scope.gridApi = gridApi;
        };

       
        console.log("TRACKING 5:: ");
        // The first one will be the active tab
        watchlist.types = {
    		"Blacklist": {
                entity: "BLACKLIST",
                icon: "user",
                columns: gridOptionsLookupService.getLookupColumnDefs('blacklist').BLACKLIST
            },
    		"Document": {
                entity: "DOCUMENT",
                icon: "file",
                columns: gridOptionsLookupService.getLookupColumnDefs('blacklist').DOCUMENT
            },
        };
        
        console.log("TRACKING 6:: ");
        $scope.data = {};
        $scope.watchlistGrid.enableRowHeaderSelection = true;
        $scope.watchlistGrid.enableSelectAll = true;
        $scope.watchlistGrid.multiSelect = true;
        $scope.watchlistGrid.columnDefs = watchlist.types.Document.columns;

        $scope.updateGridIfData = function (listName) {
        	console.log("TRACKING 7:: ");
            $scope.gridApi.selection.clearSelectedRows();
            $scope.allSelected = false;
            $scope.disableTrash = true;
            $scope.icon = watchlist.types[listName].icon;
            $scope.activeTab = listName;
            $scope.watchlistGrid.columnDefs = watchlist.types[listName].columns;
            $scope.watchlistGrid.exporterCsvFilename = 'watchlist-' + listName + '.csv';
            $scope.watchlistGrid.data = $scope.data[listName];
            
            $scope.watchlistGrid.data = [
            	{"id":1,"firstName":"Glenn","lastName":"Thompson","country":"United State"},
            	{"id":2,"firstName":"กำแพง","lastName":"คำสี","country":"Thailand"},
            	{"id":3,"firstName":"Zhen","lastName":"Fan","country":"China"},
            	{"id":4,"firstName":"Hannes","lastName":"Brom","country":"Malaysia"},
            	{"id":5,"firstName":"Pavel","lastName":"Glac","country":"Canada"},
            	{"id":6,"firstName":"Lý","lastName":"Thi Đạm","country":"Vietnam"},
            	{"id":7,"firstName":"Teru","lastName":"Suga","country":"Lao"}
        	]
            
            $scope.watchlistGrid.exporterExcelFilename = 'watchlist-' + listName + '.xlsx';
            $scope.watchlistGrid.exporterExcelSheetName= 'Data';
        };

        // get data from backend and then call updateGridIfData to update UI
        $scope.getListItemsFor = function (listName) {
        	console.log("TRACKING 8:: ");
            spinnerService.show('html5spinner');
            
            // watchListService living inside common/services.js
            // this method is used to fetch data from backend
            watchListService.getListItems(watchlist.types[listName].entity, listName).then(function (response) {
                var obj, data = [], items = response.data.result.watchlistItems,
                    setTerm = function (term) {
                        obj[term.field] = term.value;
                    };
                if (items === undefined) {
                    $scope.watchlistGrid.data = [];
                    return false;
                }
                items.forEach(function (item) {
                    obj = {id: item.id};
                    item.terms.forEach(setTerm);
                    data.push(obj);
                });
                $scope.data[listName] = data;
                $scope.updateGridIfData(listName);
                spinnerService.hide('html5spinner');
            });
        };

   

        $scope.getSaveStateText = function (activeTab) {
        	console.log("TRACKING 9:: ");
            return 'Save ';
            // todo listen to broadcast, and return save or update
        };

        $scope.updateGrid = function (listName) {
        	console.log("TRACKING 10:: ");
            if ($scope.data[listName]) {
                $scope.updateGridIfData(listName);
                return;
            }
            $scope.getListItemsFor(listName);
        };

        Object.keys(watchlist.types).forEach(function (key) {
        	console.log("TRACKING 11:: ");
        	var glyphicon = null;
        	if(key === "Blacklist"){
        		glyphicon = $sce.trustAsHtml('<i class="glyphicon glyphicon-user"></i>');
        	} else if( key === "Document"){
        		glyphicon = $sce.trustAsHtml('<i class="glyphicon glyphicon-file"></i>');
        	} else{
        		glyphicon = null;
        	}
            tabs.push({title: key, icon: glyphicon});
        });
        
        console.log("TRACKING 12:: ");
        $scope.tabs = tabs;
        $scope.activeTab = tabs[0].title;


        
        $scope.editRecord = function (row) {
        	console.log("TRACKING 13:: ");
        	console.log(row);
            $scope.gridApi.selection.clearSelectedRows();
            $scope.gridApi.selection.selectRow(row);
            $scope[$scope.activeTab] = $.extend({}, row);
            if ($scope.activeTab === "BlackList" && $scope[$scope.activeTab].dob !== undefined) {
                $scope[$scope.activeTab].dob = moment($scope[$scope.activeTab].dob).toDate();
            }

            
            // request to backend
            var dfd = $q.defer();
            dfd.resolve($http({
                method: 'get',
                url: "/gtas/notify",
                params: {
                    query: new URLSearchParams(row).toString(),
                }
            }));
            return dfd.promise;
        };



  
        $scope.showWLTypesGrid = true;


    });
}());
