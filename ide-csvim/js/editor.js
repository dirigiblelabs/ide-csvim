/*
 * Copyright (c) 2010-2021 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-FileCopyrightText: 2010-2021 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 * SPDX-License-Identifier: EPL-2.0
 */
let csvimView = angular.module('csvim-editor', []);

csvimView.factory('$messageHub', [function () {
    let messageHub = new FramesMessageHub();
    let message = function (evtName, data) {
        messageHub.post({ data: data }, evtName);
    };
    let on = function (topic, callback) {
        messageHub.subscribe(callback, topic);
    };
    return {
        message: message,
        on: on
    };
}]);

csvimView.controller('CsvimViewController', ['$scope', '$messageHub', '$window', function ($scope, $messageHub, $window) {
    let isFileChanged = false;
    const ctrlKey = 17;
    let ctrlDown = false;
    let isMac = false;
    $scope.editDisabled = true;
    $scope.dataEmpty = true;
    $scope.dataLoaded = false;
    $scope.csvimData = [];
    $scope.csvimDataFiltered = [];
    $scope.activeItemId = 0;
    $scope.delimiterList = [',', '\\t', '|', ';'];
    $scope.quoteCharList = ["'", "\""];

    $scope.openFile = function (filepath) {
        let msg = {
            "file": {
                "name": $scope.getFileName(filepath),
                "path": `/workspace/${filepath}`,
                "type": "file",
                "contentType": "text/csv",
                "label": $scope.getFileName(filepath)
            }
        };
        $messageHub.message('workspace.file.open', msg);
    };

    $scope.enableEdit = function (disabled) {
        if (disabled != undefined) {
            $scope.editDisabled = disabled;
        } else {
            $scope.editDisabled = !$scope.editDisabled;
        }
    };

    $scope.addNew = function () {
        let newCsv = {
            "name": "Untitled",
            "table": "",
            "schema": "",
            "file": "",
            "header": false,
            "useHeaderNames": false,
            "delimField": ";",
            "delimEnclosing": "\"",
            "distinguishEmptyFromNull": true,
            "keys": []
        };
        // Clean search bar
        $scope.filesSearch = "";
        $scope.csvimData.push(newCsv);
        $scope.csvimDataFiltered = $scope.csvimData;
        $scope.activeItemId = $scope.csvimData.length - 1;
        $scope.dataEmpty = false;
        $scope.fileChanged();
    };

    $scope.getFileName = function (str, canBeEmpty = true) {
        if (canBeEmpty) {
            return str.split('\\').pop().split('/').pop();
        }
        let title = str.split('\\').pop().split('/').pop();
        if (title) return title
        else return "Untitled"
    };

    $scope.fileSelected = function (id) {
        $scope.enableEdit(true);
        $scope.activeItemId = id;
    };

    $scope.delimiterChanged = function (delimiter) {
        $scope.csvimData[$scope.activeItemId].delimField = delimiter;
        $scope.fileChanged();
    };

    $scope.quoteCharChanged = function (quoteChar) {
        $scope.csvimData[$scope.activeItemId].delimEnclosing = quoteChar;
        $scope.fileChanged();
    };

    $scope.addValueToKey = function (column) {
        for (let i = 0; i < $scope.csvimData[$scope.activeItemId].keys.length; i++) {
            if ($scope.csvimData[$scope.activeItemId].keys[i].column === column) {
                $scope.csvimData[$scope.activeItemId].keys[i].values.push("");
                break;
            }
        }
        $scope.fileChanged();
    };

    $scope.addKeyColumn = function () {
        let num = 1;
        for (let i = 0; i < $scope.csvimData[$scope.activeItemId].keys.length; i++) {
            if ($scope.csvimData[$scope.activeItemId].keys[i].column === `NEW_ENTRY_${num}`) {
                num++;
            }
        }
        $scope.csvimData[$scope.activeItemId].keys.push(
            {
                "column": `NEW_ENTRY_${num}`,
                "values": []
            }
        );
        $scope.fileChanged();
    };

    $scope.save = function () {
        if (isFileChanged) {
            $scope.csvimData[$scope.activeItemId].name = $scope.getFileName($scope.csvimData[$scope.activeItemId].file, false);
            let csvim = [];
            for (let i = 0; i < $scope.csvimData.length; i++) {
                let temp = JSON.parse(JSON.stringify($scope.csvimData[i]));
                delete temp.name;
                csvim.push(temp);
            }
            saveContents(angular.toJson(csvim, true));
        }
    };

    $scope.deleteFile = function () {
        // Clean search bar
        $scope.filesSearch = "";
        $scope.csvimData.splice($scope.activeItemId, 1);
        $scope.activeItemId = 0;
        $scope.csvimDataFiltered = $scope.csvimData;
        if ($scope.csvimData.length > 0) {
            $scope.dataEmpty = false;
        } else {
            $scope.dataEmpty = true;
        }
        $scope.fileChanged();
    };

    $scope.filterFiles = function () {
        if ($scope.filesSearch) {
            let filtered = [];
            for (let i = 0; i < $scope.csvimData.length; i++) {
                if ($scope.csvimData[i].name.toLowerCase().includes($scope.filesSearch.toLowerCase())) {
                    filtered.push($scope.csvimData[i]);
                }
            }
            $scope.csvimDataFiltered = filtered;
        } else {
            $scope.csvimDataFiltered = $scope.csvimData;
        }
    };

    $scope.fileChanged = function () {
        isFileChanged = true;
        $messageHub.message('editor.file.dirty', $scope.file);
    }

    $scope.keyDownFunc = function ($event) {
        if (
            ctrlDown &&
            String.fromCharCode($event.which).toLowerCase() == 's'
        ) {
            $event.preventDefault();
            if (isFileChanged)
                $scope.save();
        }
    };

    angular.element($window).bind("keyup", function (/*$event*/) {
        ctrlDown = false;
    });

    angular.element($window).bind("keydown", function ($event) {
        if (isMac && "metaKey" in $event && $event.metaKey)
            ctrlDown = true;
        else if ($event.keyCode == ctrlKey)
            ctrlDown = true;
    });

    function getResource(resourcePath) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', resourcePath, false);
        xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
        xhr.send();
        if (xhr.status === 200) {
            csrfToken = xhr.getResponseHeader("x-csrf-token");
            return xhr.responseText;
        }
    }

    function loadContents(file) {
        if (file) {
            return getResource('../../../../../../services/v4/ide/workspaces' + file);
        }
        console.error('file parameter is not present in the URL');
    }

    function load() {
        let searchParams = new URLSearchParams(window.location.search);
        $scope.file = searchParams.get('file');
        contents = loadContents($scope.file);
        $scope.csvimData = JSON.parse(contents);
        for (let i = 0; i < $scope.csvimData.length; i++) {
            $scope.csvimData[i]["name"] = $scope.getFileName($scope.csvimData[i].file, false);
        }
        $scope.csvimDataFiltered = $scope.csvimData;
        $scope.activeItemId = 0;
        if ($scope.csvimData.length > 0) {
            $scope.dataEmpty = false;
        } else {
            $scope.dataEmpty = true;
        }
        $scope.dataLoaded = true;
    }

    function saveContents(text) {
        console.log('Save called...');
        if ($scope.file) {
            let xhr = new XMLHttpRequest();
            xhr.open('PUT', '../../../../../../services/v4/ide/workspaces' + $scope.file);
            xhr.setRequestHeader('X-Requested-With', 'Fetch');
            xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    console.log('file saved: ' + $scope.file);
                }
            };
            xhr.send(text);
            contents = text;
            isFileChanged = false;
            $messageHub.message('editor.file.saved', $scope.file);
            $messageHub.message('status.message', 'File [' + $scope.file + '] saved.');
        } else {
            console.error('file parameter is not present in the request');
        }
    }

    function checkPlatform() {
        let platform = window.navigator.platform;
        let macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'darwin', 'Mac', 'mac', 'macOS'];
        if (macosPlatforms.indexOf(platform) !== -1) isMac = true;
    }

    checkPlatform();
    load();

}]);