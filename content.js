/* StoPlay Content JS */

var StoPlay = {
    injectScript: function (scriptText) {
        var script   = document.createElement('script');
        script.type  = "text/javascript";
        script.text  = scriptText;

        var target = document.getElementsByTagName('script')[0];
        target.parentNode.insertBefore(script, target);
        return script;
    }
};

var Status = {
    PAUSED: "paused",
    PLAYING: "playing"
};

var Provider = function () {
    var _this = this;

    this.allowed = [];

    this.status = 'paused';
    this.playingTitle = '';
    this.interval = null;
    this.checkTitleInterval = null;
    this.events = {};

    this.isInstalled();

    this.customLastPlayerSelector = null;

    // check if not disabled globally or this very service
    chrome.storage.sync.get({
        enabled: true,
        providers: []
    }, function(items) {
        if (items.enabled === true) {
            this._parseAllowedProviders.call(this, items.providers);
        }
    }.bind(this));

};

Provider.prototype._parseAllowedProviders = function(providers) {
    if (!providers.length) return;
    var allowed = [];
    allowed = providers.filter(function(provider) {
        // check if any of the providers is disabled
        return provider.enabled === true;
    }).map(function(provider) {
        return provider.uri;
    });
    this.allowed = allowed;

    if (this.detectProvider()) {
        this.init();
        this.interval = setInterval(function() {
            this.checkStatus();
            this.checkAnnoyingLightboxes();
        }.bind(this), 1000);
        this.checkTitleInterval = setInterval(this.checkTitle.bind(this), 10000);
    }
}

Provider.prototype.isInstalled = function () {
    if (window.location.host.replace('www.', '') == 'stoplay_page.dev'
        || window.location.host.replace('www.', '') == 'stoplay.github.io') {
        document.querySelector("body").className = document.querySelector("body").className + " m_installed";
    }
};

Provider.prototype.on = function (name, callback) {
    if (typeof this.events[name] === 'undefined') this.events[name] = [];

    this.events[name].push(callback);

    return this;
};

Provider.prototype.trigger = function (name) {
    if (typeof this.events[name] === 'undefined') return;

    var l = this.events[name].length,
            i = 0;
    while(i < l) {
        this.events[name][i].call();
        i++;
    }
};

Provider.prototype.detectProvider = function () {
    this.host = window.location.host.replace('www.', '');

    var clearSubDomains = "";
    if (this.host.split("bandcamp.com").length > 1) {
        clearSubDomains = "bandcamp.com";
    }
    if (clearSubDomains) this.host = clearSubDomains;

    return (this.allowed.indexOf(this.host) >= 0);
};

Provider.prototype.attachEvents = function () {
    var _this = this;

    this
        .on('start', function () {
            _this.status = 'playing';
            chrome.runtime.sendMessage({action: 'started', title: _this.getTitle()});
        })
        .on('pause', function () {
            _this.status = 'paused';
            chrome.runtime.sendMessage({action: 'paused'});
        })
        .on('updateTitle', function () {
            chrome.runtime.sendMessage({action: 'updateTitle', title: _this.playingTitle});
        });
};

Provider.prototype.__changeState = function (status) {
    if (status != this.status || status == "playing") {
        switch(status) {
            case "playing":
                this.trigger( 'start' );
                break;

            case "paused":
                this.trigger( 'pause' );
                break;
        }
    }
};

Provider.prototype.getTitle = function () {
    var title = '';

    switch(this.host) {
        case "play.google.com":
            var songNameNode = document.getElementById('currently-playing-title');
            var songArtistNode = document.getElementById('player-artist');

            if (songNameNode && songArtistNode) {
                var songName = songNameNode.textContent;
                var songArtist = songArtistNode.textContent;

                title = songArtist + ' - ' + songName;
            }
            break;
    }

    return title;
};

Provider.prototype.checkTitle = function () {
    var currentTitle = this.getTitle();

    if (currentTitle !== this.playingTitle) {
        this.playingTitle = currentTitle;
        this.trigger('updateTitle');
    }
};

Provider.prototype.init = function () {
    this.attachEvents();
    switch(this.host) {
        case "deezer.com":
            StoPlay.injectScript(`
                function stoplayGetStatus() {
                    return window.dzPlayer.playing ? "playing" : "paused";
                }

                let stoplayLastStatus = stoplayGetStatus();

                setInterval(function () {
                    let currentStatus = stoplayGetStatus();

                    if (stoplayLastStatus !== currentStatus) {
                        stoplayLastStatus = currentStatus;
                        window.localStorage.setItem('stoplaystate', currentStatus);
                    }
                }, 400);
            `);
            break;
    }
};

Provider.prototype.checkStatus = function () {
    var status, p;

    switch(this.host) {
        case "vk.com":
            var player_obj = document.querySelector('.top_audio_player');
            if (player_obj) {
                status = player_obj && player_obj.classList.contains('top_audio_player_playing') ? 'playing' : 'paused';
            }
            console.log('StoPlay vk.com status', status);
            break;

        case "new.vk.com":
            status = document.querySelector('.top_audio_player')
                && document.querySelector('.top_audio_player').classList.contains('top_audio_player_playing') ? 'playing' : 'paused';
            break;

        case "last.fm":
            status = document.getElementById('webRadio').classList.contains('playing') ? 'playing' : 'paused';
            break;

        case "rutube.ru":
            p = document.querySelector('#video-object-container iframe') && document.querySelector('#video-object-container iframe').contentDocument.getElementById('rutubePlayerHolder_flash_api');
            if (p) {
                status = p.getPlayerState && p.getPlayerState();
            }
            break;

        case "pleer.net":
            status = document.querySelector('#player #play').classList.contains('pause') ? 'playing' : 'paused';
            break;

        case "vimeo.com":
        case "player.vimeo.com":
            status = document.querySelector('.play.state-playing') ? 'playing' : 'paused';
            break;

        case "tunein.com":
            status = document.getElementById('tuner') && document.getElementById('tuner').classList.contains('playing') ? 'playing' : 'paused';
            break;

        case "megogo.net":
            p = document.querySelector("video[class*='player:video']");
            status = Status.PAUSED;

            if (p && p.paused === false) {
                status = Status.PLAYING;
            }
            break;

        case "muzebra.com":
            status = document.querySelector('#player button.play').classList.contains('icon-pause') ? 'playing' : 'paused';
            break;

        case "ted.com":
        case "facebook.com":
        case "kickstarter.com":
            var videos = document.getElementsByTagName('video');

            if (videos.length > 0) {
                status = 'paused';

                for (var i = 0; i < videos.length; i++) {
                    if (videos[i] && !videos[i].paused) {
                        status = 'playing';
                    }
                }
            }
            break;

        case "gaming.youtube.com":
        case "youtube.com":
            p = document.getElementById("movie_player") || document.querySelector('.html5-video-player');
            if (p && p.getPlayerState) {
                status = p.getPlayerState() == 1 ? 'playing' : 'paused';
            } else if (document.querySelector('.html5-main-video')) {
                var video = document.querySelector('.html5-main-video');
                status = (video.paused || (!video.paused && video.currentTime == 0)) ? 'paused' : 'playing';
            } else if (document.getElementById("movie_player")) {
                status = document.getElementById("movie_player") && document.getElementById("movie_player").classList.contains('playing-mode') ? 'playing' : 'paused';
            }
            break;

        case "seasonvar.ru":
            status = document.querySelector('#vpcenter object').getUppod && document.querySelector('#vpcenter object').getUppod('getstatus');
            status = status == 1 ? 'playing' : 'paused';
            break;

        case "play.google.com":
            p = document.querySelector('[data-id="play-pause"]');
            var p2 = document.querySelector(".lava-player video");
            var p3 = document.querySelector(".playback-button.playing");

            if (p) {
                status = p.classList.contains('playing') ? 'playing' : 'paused';
            } else if (p2) {
                status = "paused";

                if (p2.paused === false) {
                    status = "playing";
                }
            } else if (p3) {
                status = "playing";
            }
            break;

        case "music.yandex.ru":
        case "music.yandex.ua":
            status = document.querySelector('.player-controls__btn_play').classList.contains('player-controls__btn_pause') ? 'playing' : 'paused';
            break;
        case "mixcloud.com":
            status = document.querySelector('.player-control') &&
                document.querySelector('.player-control')
                .classList.contains('pause-state') ? 'playing' : 'paused';
            break;
        case "soundcloud.com":
            status = document.querySelector('.playControl').classList.contains('playing') ? 'playing' : 'paused';
            break;
        case "jazzradio.com":
            status = document.querySelector('#play-button .icon-pause') ? 'playing' : 'paused';
            break;
        case "v5player.slipstreamradio.com":
            status = document.getElementById('statusLabel') &&
                document.getElementById('statusLabel')
                .textContent.toLocaleLowerCase() == 'playing' ? 'playing' : 'paused';
            break;

        case "play.spotify.com": // old UI, may be available somewhere
            status = document.getElementById('play-pause') &&
                document.getElementById('play-pause').classList.contains('playing') ? 'playing' : 'paused';
            break;
        case "open.spotify.com": // new UI
            p = document.querySelector(".control-button[class*='pause']");
            status = "paused";

            if (p) {
                status = "playing";
            }
            break;
        case "bandcamp.com":
            status = document.querySelector('.inline_player .playbutton') &&
                document.querySelector('.inline_player .playbutton').classList.contains('playing') ? 'playing' : 'paused';
            break;
        case "promodj.com":
            status = document.querySelector('.playerr_bigplaybutton .playerr_bigpausebutton') ? 'playing' : 'paused';
            break;
        case "hearthis.at":
            status = document.body.classList && document.body.classList.contains('play') ? 'playing' : 'paused';
            break;
        case "courses.prometheus.org.ua":
            status = document.querySelector('.video-controls .video_control').classList.contains('pause') ? 'playing' : 'paused';
            break;
        case "dailymotion.com":
            p = document.getElementById("dmp_Video");
            status = "paused";

            if (p
                // check for muted as when you close the video it starts playing in header muted
                && p.muted === false
                && p.paused === false
            ) {
                status = "playing";
            }
            break;
        case "netflix.com":
            p = document.querySelector(".VideoContainer video");
            status = "paused";

            if (p && p.paused === false) {
                status = "playing";
            }
            break;
        case "deezer.com":
            localStorageState = window.localStorage.getItem('stoplaystate');
            status = localStorageState ? localStorageState : null;
            break;
        case "coursera.org":
            var selector = document.querySelector('.c-video-control.vjs-control');
            status = selector && selector.classList.contains('vjs-playing') ? 'playing' : 'paused';
            break;
        case "egghead.io":
            var p = document.querySelector('.bitmovinplayer-container video');
            status = "paused";
            if (p && p.paused === false) {
                status = "playing";
            }

        case "di.fm":
            var button = document.querySelector('#webplayer-region .controls .icon-pause');
            status = "paused";
            if (button) {
                status = "playing";
            }
            break;

        case "audible.ca":
        case "audible.com":
        case "audible.com.au":
            var selector = document.querySelector('#adbl-cloud-player-controls .adblPauseButton');

            status = selector && !selector.classList.contains('bc-hidden') ? 'playing' : 'paused';
            break;

        case "play.mubert.com":
            var selector = document.querySelector('#genres .playing');

            status = selector ? 'playing' : 'paused';
            if (selector) {
                this.customLastPlayerSelector = selector;
            }
            break;

        case "udemy.com":
            var p = document.querySelector("video-viewer video");

            status = "paused";
            if (p && p.paused === false) {
                status = "playing";
            }
            break;

        case "coub.com":
            var selector = document.querySelector('.coub.active');

            if (selector) {
                status = selector.getAttribute('play-state');
            } else {
                status = 'paused';
            }
            break;

        case "livestream.com":
            var selector = document.querySelector('.playback-control .play-holder');

            status = selector && selector.classList.contains('lsp-hidden') ? 'playing' : 'paused';
            break;
    }

    status && this.__changeState(status);
};

Provider.prototype.checkAnnoyingLightboxes = function () {
};

Provider.prototype.pause = function () {
    var p;
    if (this.status == 'playing') {
        switch(this.host) {
            case "vk.com":
                document.querySelector('.top_audio_player_play').click();
                break;

            case "new.vk.com":
                document.querySelector('.top_audio_player.top_audio_player_playing .top_audio_player_play').click();
                break;

          case "last.fm":
                document.querySelector('#radioControlPause a') && document.querySelector('#radioControlPause a').click()
                break;

            case "rutube.ru":
                p = document.querySelector('#video-object-container iframe') && document.querySelector('#video-object-container iframe').contentDocument.getElementById('rutubePlayerHolder_flash_api');
                p && p.pauseVideo && p.pauseVideo();
                break;

            case "pleer.net":
                document.querySelector('#player #play.pause') && document.querySelector('#player #play.pause').click();
                break;

            case "vimeo.com":
                document.querySelector('.play.state-playing') && document.querySelector('.play.state-playing').click();
                break;

            case "tunein.com":
                document.querySelector('#tuner.playing .playbutton-cont') && document.querySelector('#tuner.playing .playbutton-cont').click();
                break;

            case "megogo.net":
                p = document.querySelector("video[class*='player:video']");

                p && !p.paused && p.pause();
                break;

            case "muzebra.com":
                document.querySelector('#player button.play.icon-pause') && document.querySelector('#player button.play.icon-pause').click();
                break;

            case "ted.com":
            case 'facebook.com':
            case "kickstarter.com":
                var videos = document.getElementsByTagName('video');

                for (var i = 0; i < videos.length; i++) {
                    if (videos[i] && !videos[i].paused) {
                        videos[i].pause();
                    }
                }
                break;

            case "gaming.youtube.com":
            case "youtube.com":
                p = document.getElementById("movie_player") || document.querySelector('.html5-video-player');
                if (p && p.pauseVideo) {
                    p.pauseVideo();
                } else {
                    document.querySelector('.ytp-play-button') && document.querySelector('.ytp-play-button').click();
                }
                break;

            case "seasonvar.ru":
                document.querySelector('#vpcenter object').sendToUppod && document.querySelector('#vpcenter object').sendToUppod('pause');
                break;

            case "play.google.com":
                p = document.querySelector('[data-id="play-pause"]');
                var p2 = document.querySelector(".lava-player video");
                var p3 = document.querySelector(".playback-button.playing");

                if (p) {
                    p.click();
                } else if (p2) {
                    p2.pause();
                } else if (p3) {
                    p3.click();
                }
                break;

            case "music.yandex.ru":
            case "music.yandex.ua":
                document.querySelector('.player-controls__btn_pause') && document.querySelector('.player-controls__btn_pause').click();
                break;
            case "mixcloud.com":
                document.querySelector('.player-control').click();
                break;
            case "soundcloud.com":
                document.querySelector('.playControl.playing') && document.querySelector('.playControl').click();
                break;
            case "jazzradio.com":
                document.querySelector('#play-button .ctl') && document.querySelector('#play-button .ctl').click();
                break;
            case "v5player.slipstreamradio.com":
                document.getElementById('pause_button') && document.getElementById('pause_button').click();
                break;
            case "play.spotify.com": // old UI
                document.getElementById('play-pause') && document.getElementById('play-pause').click();
                break;
            case "open.spotify.com": // new UI
                p = document.querySelector(".control-button[class*='pause']");

                if (p) {
                    p.click();
                }
                break;
            case "bandcamp.com":
                document.querySelector('.inline_player .playbutton') &&
                    document.querySelector('.inline_player .playbutton').click();
                break;
            case "promodj.com":
                document.querySelector('.playerr_bigplaybutton .playerr_bigpausebutton').click();
                break;
            case "hearthis.at":
                var script   = document.createElement('script');
                script.type  = "text/javascript";
                script.text  = "soundManager.pauseAll();";

                var target = document.getElementsByTagName('script')[0];
                target.parentNode.insertBefore(script, target);
                break;
            case "courses.prometheus.org.ua":
                var button   = document.querySelector('.video-controls .video_control.pause');
                
                if (button) {
                    button.click();
                }
                break;
            case "dailymotion.com":
                p = document.getElementById("dmp_Video");

                p && !p.paused && p.pause();
                break;
            case "netflix.com":
                p = document.querySelector(".VideoContainer video");

                p && !p.paused && p.pause();
                break;
            case "deezer.com":
                StoPlay.injectScript("dzPlayer.playing ? dzPlayer.control.pause() : void(0);");
                break;
            case "coursera.org":
                var button = document.querySelector('.c-video-control.vjs-control.vjs-playing');
                if (button) {
                    button.click();
                }
                break;
            case "egghead.io":
                var button = document.querySelector('.bmpui-ui-playbacktoggle-overlay button');
                if (button) {
                    button.click();
                }
                break;

            case "di.fm":
                var button = document.querySelector('#webplayer-region .controls .icon-pause');
                if (button) {
                    button.click();
                }
                break;

            case "audible.ca":
            case "audible.com":
            case "audible.com.au":
                var selector = document.querySelector('#adbl-cloud-player-controls .adblPauseButton');
    
                if (selector && !selector.classList.contains('bc-hidden')) {
                    selector.click();
                }
                break;

            case "play.mubert.com":
                var selector = this.customLastPlayerSelector;
                if (selector && selector.classList.contains('playing')) {
                    selector.click();
                }
                break;

            case "coub.com":
                var selector = document.querySelector('.coub.active .viewer__click');

                if (selector) {
                    selector.click()
                }
                break;

            case "livestream.com":
                var selector = document.querySelector('.playback-control .play-holder');

                if (selector && selector.classList.contains('lsp-hidden')) {
                    document.querySelector('.playback-control .pause-holder').click();                       
                };
                break;

            case "udemy.com":
                p = document.querySelector("video-viewer video");

                p && !p.paused && p.pause();
                break;
        }
        this.__changeState('paused');
    }
};

Provider.prototype.play = function () {
    var p;
    if (this.status != 'playing') {
        switch(this.host) {
            case "vk.com":
                document.querySelector('.top_audio_player_play').click();
                break;

            case "new.vk.com":
                document.querySelector('.top_audio_player .top_audio_player_play').click();
                break;

            case "last.fm":
                document.querySelector('#radioControlPlay a') && document.querySelector('#radioControlPlay a').click()
                break;

            case "rutube.ru":
                p = document.querySelector('#video-object-container iframe') && document.querySelector('#video-object-container iframe').contentDocument.getElementById('rutubePlayerHolder_flash_api');
                p && p.playVideo && p.playVideo();
                break;

            case "pleer.net":
                document.querySelector('#player #play.play') && document.querySelector('#player #play.play').click();
                break;

            case "vimeo.com":
                document.querySelector('.play.state-paused') && document.querySelector('.play.state-paused').click();
                break;

            case "tunein.com":
                document.querySelector('#tuner.stopped .playbutton-cont') && document.querySelector('#tuner.stopped .playbutton-cont').click();
                break;

            case "megogo.net":
                p = document.querySelector("video[class*='player:video']");

                p && p.paused && p.play();
                break;

            case "muzebra.com":
                document.querySelector('#player button.play.icon-play') && document.querySelector('#player button.play.icon-play').click();
                break;

            case "ted.com":
            case 'facebook.com':
            case "kickstarter.com":
                var videos = document.getElementsByTagName('video');

                for (var i = 0; i < videos.length; i++) {
                    if (videos[i] && videos[i].paused && videos[i].played.length > 0) {
                        videos[i].play();
                    }
                }
                break;

            case "gaming.youtube.com":
            case "youtube.com":
                p = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
                if (p && p.playVideo) {
                    p.playVideo();
                } else {
                    document.querySelector('.ytp-play-button') && document.querySelector('.ytp-play-button').click();
                }
                break;

            case "seasonvar.ru":
                document.querySelector('#vpcenter object').sendToUppod && document.querySelector('#vpcenter object').sendToUppod('play');
                break;

            case "play.google.com":
                p = document.querySelector('[data-id="play-pause"]');
                var p2 = document.querySelector(".lava-player video");
                var p3 = document.querySelector(".playback-button");

                if (p) {
                    p.click();
                } else if (p2) {
                    p2.play();
                } else if (p3) {
                    p3.click();
                }

                break;

            case "music.yandex.ru":
            case "music.yandex.ua":
                document.querySelector('.player-controls__btn_play') && document.querySelector('.player-controls__btn_play').click();
                break;

            case "mixcloud.com":
                document.querySelector('.player-control').click();
                break;
            case "soundcloud.com":
                document.querySelector('.playControl') && document.querySelector('.playControl').click();
                break;
            case "jazzradio.com":
                document.querySelector('#play-button .ctl') && document.querySelector('#play-button .ctl').click();
                break;
            case "v5player.slipstreamradio.com":
                document.getElementById('play_button') && document.getElementById('play_button').click();
                break;
            case "play.spotify.com": // old UI
                document.getElementById('play-pause') && document.getElementById('play-pause').click();
                break;
            case "open.spotify.com": // new UI
                p = document.querySelector(".control-button[class*='play']");

                if (p) {
                    p.click();
                }
                break;
            case "bandcamp.com":
                document.querySelector('.inline_player .playbutton') &&
                    document.querySelector('.inline_player .playbutton').click();
                break;
            case "promodj.com":
                document.querySelector('.playerr_bigplaybutton .playerr_bigplaybutton').click();
                break;
            case "hearthis.at":
                var script   = document.createElement('script');
                script.type  = "text/javascript";
                script.text  = "soundManager.resumeAll();";

                var target = document.getElementsByTagName('script')[0];
                target.parentNode.insertBefore(script, target);
                break;
            case "courses.prometheus.org.ua":
                var button   = document.querySelector('.video-controls .video_control.play');
                
                if (button) {
                    button.click();
                }
                break;
            case "dailymotion.com":
                p = document.getElementById("dmp_Video");

                p && p.paused && p.play();
                break;
            case "netflix.com":
                p = document.querySelector(".VideoContainer video");

                p && p.paused && p.play();
                break;
            case "deezer.com":
                StoPlay.injectScript("dzPlayer.paused ? dzPlayer.control.play() : void(0);");
                break;
            case "coursera.org":
                var button = document.querySelector('.c-video-control.vjs-control.vjs-paused');
                if (button) {
                    button.click();
                }
                break;
            case "egghead.io":
                var button = document.querySelector('.bmpui-ui-playbacktoggle-overlay button');
                if (button) {
                    button.click();
                }
                break;

            case "di.fm":
                var button = document.querySelector('#webplayer-region .controls .icon-play');
                if (button) {
                    button.click();
                }
                break;

            case "audible.ca":
            case "audible.com":
            case "audible.com.au":
                var selector = document.querySelector('#adbl-cloud-player-controls .adblPlayButton');
    
                if (selector && !selector.classList.contains('bc-hidden')) {
                    selector.click();
                }
                break;    
            case "play.mubert.com":
                var selector = this.customLastPlayerSelector;
                if (selector && !selector.classList.contains('playing')) {
                    selector.click();
                }
                break;

            case "udemy.com":
                p = document.querySelector("video-viewer video");

                p && p.paused && p.play();
                break;

            case "coub.com":
                var selector = document.querySelector('.coub.active .viewer__replay');

                if (selector) {
                    selector.click()
                }
                break;

            case "livestream.com":
                var selector = document.querySelector('.playback-control .play-holder');

                if (selector && !selector.classList.contains('lsp-hidden')) {
                    document.querySelector('.playback-control .play-holder').click();                       
                };
                break;
        }
        this.__changeState('playing');
    }
};

var ProviderInstance = new Provider();

if (ProviderInstance) {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action == 'pause') {
            ProviderInstance.pause();
        }

        if (request.action == 'play') {
            ProviderInstance.play();
        }
    });
}
