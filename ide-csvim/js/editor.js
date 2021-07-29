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

csvimView.directive('uniqueField', () => {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: (scope, element, attrs, controller) => {
            controller.$validators.forbiddenName = value => {
                let unique = true;
                if ("index" in attrs) {
                    for (let i = 0; i < scope.csvimData[scope.activeItemId].keys.length; i++) {
                        if (i != attrs.index) {
                            if (value === scope.csvimData[scope.activeItemId].keys[i].column) {
                                unique = false;
                                break;
                            }
                        }
                    }
                } else if ("kindex" in attrs && "vindex" in attrs) {
                    for (let i = 0; i < scope.csvimData[scope.activeItemId].keys[attrs.kindex].values.length; i++) {
                        if (i != attrs.vindex) {
                            if (value === scope.csvimData[scope.activeItemId].keys[attrs.kindex].values[i]) {
                                unique = false;
                                break;
                            }
                        }
                    }
                }
                if (unique) {
                    element.removeClass("error-input");
                } else {
                    element.addClass('error-input');
                }
                scope.setSaveEnabled(unique);
                return unique;
            };
        }
    };
});

csvimView.controller('CsvimViewController', ['$scope', '$messageHub', '$window', function ($scope, $messageHub, $window) {
    let isFileChanged = false;
    const ctrlKey = 17;
    let ctrlDown = false;
    let isMac = false;
    var csrfToken;
    var contents;
    $scope.fileExists = true;
    $scope.saveEnabled = true;
    $scope.editDisabled = true;
    $scope.dataEmpty = true;
    $scope.dataLoaded = false;
    $scope.csvimData = [];
    $scope.csvimDataFiltered = [];
    $scope.activeItemId = 0;
    $scope.delimiterList = [',', '\\t', '|', ';'];
    $scope.quoteCharList = ["'", "\""];

    $scope.openFile = function (filepath) {
        if ($scope.checkResource(filepath)) {
            let msg = {
                "file": {
                    "name": $scope.getFileName(filepath),
                    "path": `${filepath}`,
                    "type": "file",
                    "contentType": "text/csv",
                    "label": $scope.getFileName(filepath)
                }
            };
            $messageHub.message('workspace.file.open', msg);
        }
    };

    $scope.setSaveEnabled = function (enabled) {
        $scope.saveEnabled = enabled;
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
        $scope.fileExists = true;
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
        let num = 1;
        for (let i = 0; i < $scope.csvimData[$scope.activeItemId].keys.length; i++) {
            if ($scope.csvimData[$scope.activeItemId].keys[i].column === column) {
                for (let k = 0; k < $scope.csvimData[$scope.activeItemId].keys[i].values.length; k++) {
                    if ($scope.csvimData[$scope.activeItemId].keys[i].values[k] === `NEW_ENTRY_${num}`) {
                        num++;
                    }
                }
                $scope.csvimData[$scope.activeItemId].keys[i].values.push(`NEW_ENTRY_${num}`);
                break;
            }
        }
        $scope.fileChanged();
    };

    $scope.removeValueFromKey = function (columnIndex, valueIndex) {
        $scope.csvimData[$scope.activeItemId].keys[columnIndex].values.splice(valueIndex, 1);
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

    $scope.removeKeyColumn = function (index) {
        $scope.csvimData[$scope.activeItemId].keys.splice(index, 1);
        $scope.fileChanged();
    };

    $scope.save = function () {
        if (isFileChanged && $scope.saveEnabled) {
            $scope.checkResource($scope.csvimData[$scope.activeItemId].file);
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

    $scope.checkResource = function (resourcePath) {
        if (resourcePath != "") {
            let xhr = new XMLHttpRequest();
            xhr.open('HEAD', `../../../../../../services/v4/ide/workspaces${resourcePath}`, false);
            xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
            xhr.send();
            if (xhr.status === 200) {
                csrfToken = xhr.getResponseHeader("x-csrf-token");
                $scope.fileExists = true;
                return true;
            }
        }
        $scope.fileExists = false;
        return false;
    }

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