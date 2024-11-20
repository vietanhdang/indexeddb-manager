document.addEventListener("DOMContentLoaded", function () {
    // Initialize Select2
    $(".select2-base").select2({
        width: "100%",
        placeholder: "Select an option",
        allowClear: true,
    });

    const $dbSelect = $("#dbSelect");
    const $storeSelect = $("#storeSelect");
    const $refreshBtn = $("#refreshBtn");
    const $addNewBtn = $("#addNewBtn");
    const $clearAllBtn = $("#clearAllBtn");
    const $addForm = $("#addForm");
    const $keyInput = $("#keyInput");
    const $valueInput = $("#valueInput");
    const $saveBtn = $("#saveBtn");
    const $cancelBtn = $("#cancelBtn");
    const $dataList = $("#dataList");
    const $searchKeyInput = $("#searchKeyInput");
    const $jsonViewerOptions = $(".json-viewer-options");
    const $frmAction = $("#frm-action");


    //----------------Function----------------

    // Format JSON data for display
    function formatJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    // Load databases
    async function loadDatabases() {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                function: () => {
                    return indexedDB.databases();
                },
            },
            (results) => {
                const databases = results[0].result;
                $(dbSelect)
                    .empty()
                    .append('<option value="">Select Database</option>');
                databases.forEach((db) => {
                    const option = new Option(db.name, db.name);
                    $(dbSelect).append(option);
                });
                $(dbSelect).trigger("change");
            }
        );
    }

    // Load stores
    async function loadStores(dbName) {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [dbName],
                function: (dbName) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            resolve(Array.from(db.objectStoreNames));
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            (results) => {
                const stores = results[0].result;
                $(storeSelect)
                    .empty()
                    .append('<option value="">Select Store</option>');
                stores.forEach((store) => {
                    const option = new Option(store, store);
                    $(storeSelect).append(option);
                });
                $(storeSelect).trigger("change");
            }
        );
    }

    // Display data
    function displayData(data) {
        $dataList.empty();
        data.forEach((item) => {
            const div = $("<div>").addClass("card data-item").html(`
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="font-medium text-gray-700 mb-1 data-key">Key: ${item.key}</div>
                        <pre class="text-sm bg-gray-50 p-2 rounded overflow-x-auto data-value"></pre>
                    </div>
                    <div class="flex gap-2 ml-4">
                        <button class="btn btn-secondary edit-btn" data-key="${item.key}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="btn btn-danger delete-btn" data-key="${item.key}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            `);

           // Chuyển đổi và hiển thị dữ liệu JSON sử dụng jquery.json-viewer
            div.find(".data-value").data("json", item.value);

            // Lấy các tùy chọn hiển thị JSON từ local storage
            chrome.storage.local.get("jsonViewerOptions", (data) => {
                const options = data.jsonViewerOptions || {};
                div.find(".data-value").jsonViewer(item.value, options);
            });

            $dataList.append(div);
        });

        if (data.length === 0) {
            $dataList.html('<div class="text-center text-gray-500">No data found</div>');
            $frmAction.addClass("hidden");
        } else {
            $frmAction.removeClass("hidden");
        }
    }

    // Load data
    async function loadData() {
        if (!currentDB || !currentStore) return;

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [currentDB, currentStore],
                function: (dbName, storeName) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(
                                storeName,
                                "readonly"
                            );
                            const store = transaction.objectStore(storeName);
                            const data = [];

                            store.openCursor().onsuccess = (event) => {
                                const cursor = event.target.result;
                                if (cursor) {
                                    data.push({
                                        key: cursor.key,
                                        value: cursor.value,
                                    });
                                    cursor.continue();
                                } else {
                                    resolve(data);
                                }
                            };
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            (results) => {
                const data = results[0].result;
                displayData(data);
            }
        );
    }

    // Edit item function
    async function editItem(key) {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [currentDB, currentStore, key],
                function: (dbName, storeName, key) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(
                                storeName,
                                "readonly"
                            );
                            const store = transaction.objectStore(storeName);
                            const getRequest = store.get(key);

                            getRequest.onsuccess = () =>
                                resolve(getRequest.result);
                            getRequest.onerror = () => reject(getRequest.error);
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            (results) => {
                const value = results[0].result;
                $keyInput.val(key);
                $valueInput.val(formatJSON(value));
                $addForm.removeClass("hidden");
            }
        );
    };

    // Save item
    async function saveItem(key, value) {
        // nếu giá trị đầu của key là số thì cảnh báo
        if (!isNaN(key.charAt(0))) {
            showNotification("Key must not start with a number", "error");
            return;
        }

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [currentDB, currentStore, key, value],
                function: (dbName, storeName, key, value) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(
                                storeName,
                                "readwrite"
                            );
                            const store = transaction.objectStore(storeName);
                            const saveRequest = store.put(value, key);

                            saveRequest.onsuccess = () => resolve(true);
                            saveRequest.onerror = () =>
                                reject(saveRequest.error);
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            () => {
                loadData();
                $addForm.addClass("hidden");
                $keyInput.val("");
                $valueInput.val("");
            }
        );
    }

    // Delete item
    async function deleteItem(key) {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [currentDB, currentStore, key],
                function: (dbName, storeName, key) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        // Tiếp tục phần popup.js
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(
                                storeName,
                                "readwrite"
                            );
                            const store = transaction.objectStore(storeName);
                            const deleteRequest = store.delete(key);

                            deleteRequest.onsuccess = () => resolve(true);
                            deleteRequest.onerror = () =>
                                reject(deleteRequest.error);
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            () => {
                loadData();
            }
        );
    }

    // Clear all data
    async function clearAll() {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                args: [currentDB, currentStore],
                function: (dbName, storeName) => {
                    return new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(
                                storeName,
                                "readwrite"
                            );
                            const store = transaction.objectStore(storeName);
                            const clearRequest = store.clear();

                            clearRequest.onsuccess = () => resolve(true);
                            clearRequest.onerror = () =>
                                reject(clearRequest.error);
                        };
                        request.onerror = () => reject(request.error);
                    });
                },
            },
            () => {
                loadData();
            }
        );
    }

    // Format JSON helper
    function formatJSON(obj) {
        try {
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return JSON.stringify({});
        }
    }

    // Error handler
    function handleError(error) {
        console.error("Error:", error);
        showNotification(
            "Error: " + (error.message || "Unknown error occurred"),
            "error"
        );
    }

    // Load last option
    function lastOption() {
        chrome.storage.local.get("jsonViewerOptions", (data) => {
            const options = data.jsonViewerOptions || {};
            $jsonViewerOptions.each(function () {
                const key = $(this).data("action");
                const value = options[key];
                $(this).prop("checked", value);
            });
        });
    }

    // Notification system
    function showNotification(message, type = "info") {
        const $notification = $("<div></div>")
            .addClass(`fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white`)
            .addClass(type === "error" ? "bg-red-500" : "bg-green-500")
            .text(message);

        $("body").append($notification);

        setTimeout(() => {
            $notification.remove();
        }, 3000);
    }


    //----------------Event----------------

    // Event listeners
    $dbSelect.on("select2:select", function (e) {
        currentDB = e.target.value;
        if (currentDB) {
            loadStores(currentDB);
        }
    });

    $storeSelect.on("select2:select", function (e) {
        currentStore = e.target.value;
        if (currentStore) {
            loadData();
        }
    });

    $refreshBtn.on("click", function () {
        loadDatabases();
    });

    $addNewBtn.on("click", function () {
        $keyInput.val("");
        $valueInput.val("");
        $addForm.removeClass("hidden");
    });

    $saveBtn.on("click", function () {
        try {
            const key = $keyInput.val();
            const value = JSON.parse($valueInput.val());
            if (key && value) {
                saveItem(key, value);
            } else {
                throw new Error("Key and value are required");
            }
        } catch (e) {
            showNotification(
                "Error: " + (e.message || "Invalid JSON format"),
                "error"
            );
        }
    });

    $cancelBtn.on("click", function () {
        $addForm.addClass("hidden");
        $keyInput.val("");
        $valueInput.val("");
    });

    $clearAllBtn.on("click", function () {
        if (
            confirm(
                "Are you sure you want to clear all data? This action cannot be undone."
            )
        ) {
            clearAll();
        }
    });

    $searchKeyInput.on("input", function () {
        const searchKey = $(this).val().toLowerCase();
        $("#dataList .card").each(function () {
            const key = $(this).find(".data-key").text().toLowerCase();
            const value = $(this).find(".data-value").text().toLowerCase();
            if (key.includes(searchKey) || value.includes(searchKey)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });

    $jsonViewerOptions.on("change", function () {
        const options = {};
        $jsonViewerOptions.each(function () {
            const key = $(this).data("action");
            console.log(key);
            const value = $(this).prop("checked");
            options[key] = value;
        });

        // Save options to local storage
        chrome.storage.local.set({ jsonViewerOptions: options });

        // force update json viewer
        $(".data-value").each(function () {
            const json = $(this).data("json");
            $(this).jsonViewer(json, options);
        });
    });

    $dataList.on("click", ".edit-btn", async function () {
        const key = $(this).data("key");
        await editItem(key);
    });

    $dataList.on("click", ".delete-btn", async function () {
        const key = $(this).data("key");
        await deleteItem(key);
    });

    // Add keyboard shortcuts
    $(document).on("keydown", function (e) {
        // Escape key closes add/edit form
        if (e.key === "Escape") {
            $addForm.addClass("hidden");
        }

        // Ctrl/Cmd + S saves current item
        if (
            (e.ctrlKey || e.metaKey) &&
            e.key === "s" &&
            !$addForm.hasClass("hidden")
        ) {
            e.preventDefault();
            $saveBtn.trigger("click"); // Gọi sự kiện click cho nút lưu
        }
    });

    // Add error handlers to promises
    window.addEventListener("unhandledrejection", function (event) {
        handleError(event.reason);
    });

    // Load last option
    lastOption();

    // Initialize extension
    loadDatabases();
});
