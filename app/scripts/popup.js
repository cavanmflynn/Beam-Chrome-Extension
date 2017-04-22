'use strict';

// Initialize Firebase

var config = {
    apiKey: 'AIzaSyBUIOa0QgNxkK9hOrOZCfmkf7928iAR9zI',
    databaseURL: 'https://get-beam.firebaseio.com',
    storageBucket: 'get-beam.appspot.com'
};
firebase.initializeApp(config);

var db = firebase.database();
var auth = firebase.auth();
var firepad = null;
var downloadURL = null;
var codeMirror = null;

function initApp() {
    // Listen for auth state changes.
    firebase.auth().onAuthStateChanged(function (user) {

        // Hide Loading View
        document.getElementById('loading-container').style.display = 'none';

        if (user) {
            // User is signed in.
            var displayName = user.displayName;
            var email = user.email;
            var emailVerified = user.emailVerified;
            var photoURL = user.photoURL;
            var isAnonymous = user.isAnonymous;
            var uid = user.uid;
            var providerData = user.providerData;

            //// Create CodeMirror (with lineWrapping on).
            codeMirror = CodeMirror(document.getElementById('firepad-container'), {
                lineWrapping: true,
                mode: ''
            });
            //// Create Firepad (with rich text toolbar and shortcuts enabled).
            firepad = Firepad.fromCodeMirror(db.ref().child(user.uid), codeMirror, {
                richTextToolbar: false,
                richTextShortcuts: true,
                userColor: '#ffffff'
            });

            //// Initialize contents.
            firepad.on('ready', function () {
                if (firepad.isHistoryEmpty()) {
                    firepad.setHtml('Welcome to Beam! <br/>Anything you type here will be available wherever you login next!');
                }
            });

            // Register the download link on receiving computers.
            firepad.registerEntity('link', {
              render: function (info, entityHandler) {
                  var inputElement = document.createElement('a');
                  inputElement.innerHTML = info.innerHTML;
                  inputElement.setAttribute('download', 'download');
                  inputElement.setAttribute('target', '_blank');
                  inputElement.setAttribute('class', 'btn green accent-4');
                  inputElement.style.textTransform = 'capitalize';
                  inputElement.href = info.href;

                  return inputElement;
                }.bind(this),
                fromElement: function fromElement(element) {

                    var info = {};

                    if (element.innerHTML === "") {
                      info.innerHTML = 'Download ' + filename;
                      info.href = downloadURL;
                    } else {
                      info.innerHTML = element.innerHTML;
                      info.href = element.href;
                    }

                    return info;
                },
                update: function update(info, element) {
                    element.innerHTML = info.innerHTML;
                    element.setAttribute('target', '_blank');
                    element.setAttribute('download', 'download');
                    element.setAttribute('class', 'btn green accent-4');
                    element.style.textTransform = 'capitalize';
                    element.href = info.href;
                },
                export: function _export(info) {
                    var inputElement = document.createElement('a');
                    inputElement.innerHTML = info.innerHTML;
                    inputElement.setAttribute('download', 'download');
                    inputElement.setAttribute('target', '_blank');
                    inputElement.setAttribute('class', 'btn green accent-4');
                    inputElement.style.textTransform = 'capitalize';
                    inputElement.href = info.href;

                    return inputElement;
                }
            });

            document.getElementById('login-container').style.display = 'none';
            document.getElementById('authenticated-container').style.display = 'block';
            document.documentElement.style.height = '600px';
            document.getElementById('logout-button').addEventListener('click', logout);
            document.getElementById('file-input').addEventListener('change', uploadFile);

            // Remove to avoid duplicates
            var firepadDivs = document.getElementsByClassName('firepad');

            for (var i = 0; i < firepadDivs.length; i++) {
                if (i !== 0) {
                    firepadDivs[i].parentNode.removeChild(firepadDivs[i]);
                }
            }
        } else {
            document.getElementById('authenticated-container').style.display = 'none';

            // Show Login View
            document.getElementById('login-container').style.display = 'block';

            document.getElementById('google-button').addEventListener('click', startSignIn, false);
        }
    });
}

// Start auth flow and authorize with Firebase.
function startAuth(interactive) {
    // Request an OAuth token from the Chrome Identity API.
    chrome.identity.getAuthToken({ interactive: !!interactive }, function (token) {
        if (chrome.runtime.lastError && !interactive) {
            console.log('It was not possible to get a token programmatically.');
        } else if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        } else if (token) {
            // Authorize Firebase with the OAuth Access Token.
            var credential = firebase.auth.GoogleAuthProvider.credential(null, token);
            firebase.auth().signInWithCredential(credential).catch(function (error) {
                // The OAuth token might have been invalidated. Lets' remove it from cache.
                if (error.code === 'auth/invalid-credential') {
                    chrome.identity.removeCachedAuthToken({ token: token }, function () {
                        startAuth(interactive);
                    });
                }
            });
        } else {
            console.error('The OAuth Token was null');
        }
    });
}

/**
 * Starts the sign-in process.
 */
function startSignIn() {
    startAuth(true);
}

/**
 * Logs a user out of the application.
 */
function logout() {
    document.documentElement.style.height = '290px';
    firebase.auth().signOut();
}

window.onload = function () {
    initApp();
};

/**
 * File Upload
 */
function uploadFile() {
    // File or Blob
    var file = document.querySelector('input[type=file]').files[0];
    var filename = document.querySelector('input[type=file]').files[0].name;
    var filetype = document.querySelector('input[type=file]').files[0].type;

    document.getElementById('file-name').value = filename;

    // Create a root reference
    var storageRef = firebase.storage().ref();

    // Unique File Path
    var uid = firebase.auth().currentUser.uid;

    // Create the file metadata
    var metadata = {
        contentType: filetype
    };

    // Upload file and metadata to the object 'files/...'
    var uploadTask = storageRef.child(uid + '/' + filename).put(file, metadata);

    // Listen for state changes, errors, and completion of the upload.
    uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
    function (snapshot) {
        // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
        var progress = snapshot.bytesTransferred / snapshot.totalBytes * 100;

        document.getElementById('file-loader').setAttribute('style', 'width:' + progress + '%');

        if (progress === 100) {
            document.getElementById('file-loader').setAttribute('style', 'width: 0%');
            document.getElementById('file-name').value = '';
        }

        switch (snapshot.state) {
            case firebase.storage.TaskState.PAUSED:
                console.log('Upload is paused');
                break;
            case firebase.storage.TaskState.RUNNING:
                console.log('Upload is running');
                break;
        }
    }, function (error) {
        switch (error.code) {
            case 'storage/unauthorized':
                alert('You do not have permission to access this object.');
                break;

            case 'storage/canceled':
                alert('Upload was canceled.');
                break;

            case 'storage/unknown':
                alert('An unknown error occurred.');
                break;
        }
    }, function () {
        // Upload completed successfully, get the download URL
        downloadURL = uploadTask.snapshot.downloadURL;
        var currentText = firepad.getHtml();
        var updatedText = '<br/><br/><link></link>';
        firepad.setHtml(currentText + updatedText);
    });

    // Register the download link.
    firepad.registerEntity('link', {
      render: function (info, entityHandler) {
          var inputElement = document.createElement('a');
          inputElement.innerHTML = info.innerHTML;
          inputElement.setAttribute('download', 'download');
          inputElement.setAttribute('target', '_blank');
          inputElement.setAttribute('class', 'btn green accent-4');
          inputElement.style.textTransform = 'capitalize';
          inputElement.href = info.href;

          return inputElement;
        }.bind(this),
        fromElement: function fromElement(element) {

            var info = {};

            if (element.innerHTML === "") {
              info.innerHTML = 'Download ' + filename;
              info.href = downloadURL;
            } else {
              info.innerHTML = element.innerHTML;
              info.href = element.href;
            }

            return info;
        },
        update: function update(info, element) {
            element.innerHTML = info.innerHTML;
            element.setAttribute('target', '_blank');
            element.setAttribute('download', 'download');
            element.setAttribute('class', 'btn green accent-4');
            element.style.textTransform = 'capitalize';
            element.href = info.href;
        },
        export: function _export(info) {
            var inputElement = document.createElement('a');
            inputElement.innerHTML = info.innerHTML;
            inputElement.setAttribute('download', 'download');
            inputElement.setAttribute('target', '_blank');
            inputElement.setAttribute('class', 'btn green accent-4');
            inputElement.style.textTransform = 'capitalize';
            inputElement.href = info.href;

            return inputElement;
        }
    });
}
