(function () {
    var containers = [];

    function FileFrame(elem, options)
    {
        var _this = this;
        var ajax = [];
        this.input = $(elem);
        this.options = {
            files: [],
            url: document.location.href.replace(document.location.hash, ''),
            action: 'frame_download_file',
            action_delete: 'frame_delete_file',
            action_cover: 'frame_cover_file',
            limit: 0
        };

        this.init = function ()
        {
            this.options = $.extend(this.options, options);

            var wrap = $('<div></div>').addClass('file_frame');
            var label = $('<label></label>')
                .attr('for', 'file_frame_'+this.input.data('file-frame'));
            this.input.attr('id', 'file_frame_'+this.input.data('file-frame'));
            label.html('<i class="icon-file"></i>'+this.input.data('file-text')).addClass('text_file_frame');
            label.append(this.input.clone(true));
            wrap.append(label);
            this.input.replaceWith(wrap);
            this.input = $('label[for="file_frame_'+this.input.data('file-frame')+'"]').closest('.file_frame');
            this.input.find('input[type=file][data-file-frame]').live('change', function (e) {
                console.log(e.target);
                var file = $(this).get(0);
                if (file.files.length)
                {
                    _this.removeStageMessage();
                    _this.setLoading();

                    if (_this.options.limit
                        && _this.options.files.length >= _this.options.limit)
                    {
                        _this.viewError([text_limit_files.replace('%s', _this.options.limit)]);
                        _this.clearLoading();
                        return;
                    }

                    _this.downloadFiles(file.files, function (response, errors, end_download) {
                        if (end_download)
                            _this.clearLoading();
                        if (errors.length)
                            _this.viewError(errors, !end_download);
                        //_this.options.files = _this.options.files.concat(response);
                        //_this.renderFiles();
                    });
                }
            });

            this.input.find('[data-remove]').live('click', function () {
                _this.removeStageMessage();
                _this.setLoading();
                var id = $(this).data('remove');
                ajax.push($.ajax({
                    url: _this.options.url,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        ajax: true,
                        action: _this.options.action_delete,
                        file: id
                    },
                    success: function (r) {
                        _this.clearLoading();
                        if (!r.errors.length)
                        {
                            var choice = null;
                            $.each(_this.options.files, function (index, file) {
                                if (file.id == id)
                                    choice = index;
                            });
                            if (choice != null)
                                _this.options.files.splice(choice, 1);
                            _this.renderFiles();
                        }
                        else
                            _this.viewError(r.errors);
                    },
                    error: function () {
                        _this.clearLoading();
                        _this.viewError(['Response return error!']);
                    }
                }));
            });

            this.input.find('[data-cover]').live('click', function () {
                _this.removeStageMessage();
                _this.setLoading();
                var id = $(this).data('cover');
                ajax.push($.ajax({
                    url: _this.options.url,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        ajax: true,
                        action: _this.options.action_cover,
                        file: id
                    },
                    success: function (r) {
                        _this.clearLoading();
                        if (!r.errors.length)
                        {
                            $.each(_this.options.files, function (index, file) {
                                if (file.id == id)
                                    _this.options.files[index].cover = 1;
                                else
                                    _this.options.files[index].cover = 0;
                            });
                            _this.renderFiles();
                        }
                        else
                            _this.viewError(r.errors);
                    },
                    error: function () {
                        _this.clearLoading();
                        _this.viewError(['Response return error!']);
                    }
                }));
            });

            this.renderFiles();

            if (_this.options.limit)
            {
                _this.viewDanger([text_limit_files_warning.replace('%s', _this.options.limit)]);
                _this.clearLoading();
            }
        };

        this.downloadFiles = function (files, callback) {
            var nb_files = files.length;
            var response = [];
            var ready_ajax = 0;
            var errors = [];
            var breakCycle = false;

            var stackQuery = [];

            $.each(files, function (index, file) {
                stackQuery.push(function () {
                    if (_this.options.limit
                        && _this.options.files.length >= _this.options.limit)
                    {
                        breakCycle = true;
                        errors.push(text_limit_files.replace('%s', _this.options.limit));
                        _this.restoreFileInput();
                        stackQuery = [];
                        callback(response, errors, true);
                        return;
                    }

                    if (breakCycle)
                        return;

                    downloadFile(file, function (r) {
                        if (r.errors.length)
                            errors = errors.concat(r.errors);
                        else
                        {
                            response.push(r.file);
                            _this.options.files.push(r.file);
                            _this.renderFiles();
                        }

                        if (!stackQuery.length)
                        {
                            callback(response, errors, true);
                            _this.restoreFileInput();
                        }
                        else
                        {
                            var query = stackQuery.pop();
                            query();
                        }
                    }, function () {
                        ready_ajax++;
                        callback(response, [file.name + ' has error!'], !stackQuery.length);
                        _this.restoreFileInput();
                    });
                });
            });

            function downloadFile(file, success, error)
            {
                var data = new FormData();
                data.append('ajax', true);
                data.append('action', _this.options.action);
                data.append('file', file);

                ajax.push($.ajax({
                    url: _this.options.url,
                    type: 'POST',
                    dataType: 'json',
                    cache: false,
                    contentType: false,
                    processData: false,
                    data: data,
                    success: success,
                    error: error
                }));
            }

            if (stackQuery.length)
            {
                var query = stackQuery.pop();
                query();
            }
        };

        this.renderFiles = function () {
            this.getFrame().find('.frame_image').remove();
            $.each(this.options.files, function (index, file) {
                var div = $('<div></div>').addClass('frame_image');
                var remove_link = $('<a>×</a>').attr('data-remove', file.id);
                var cover_link = $('<a><i class="icon-check"></i></a>').attr('data-cover', file.id);
                if (parseInt(file.cover))
                    cover_link.addClass('cover');
                var img = $('<img>').addClass('img-responsive').attr('src', file.image);
                if (file.id.indexOf('tmp-') != -1)
                {
                    var hidden = $('<input>').attr('name', 'image[]');
                    hidden.attr('type', 'hidden');
                    hidden.val(file.id);
                    div.append(hidden);
                }
                else
                    div.append(cover_link);

                div.append(remove_link);
                div.append(img);
                _this.getFrame().append(div);
            });
            _this.getFrame().append('<div class="clearfix"></div>');
        };

        this.setFiles = function (files) {
            this.options.files = files;
            this.renderFiles();
        };

        this.getFrame = function () {
            return _this.input;
        };
        
        this.viewError = function (errors, append) {
            console.error(errors.join('\n'));
            if (!this.getFrame().find('.frame_file_error').length)
                this.getFrame().prepend('<div class="frame_file_error"></div>');
            this.getFrame().find('.frame_file_error')[(append ? 'append' : 'html')](errors.join('<br>') + '<br>').stop(true, true).slideDown(300);
        };

        this.viewDanger = function (errors, append) {
            console.warn(errors.join('\n'));
            if (!this.getFrame().find('.frame_file_warning').length)
                this.getFrame().prepend('<div class="frame_file_warning"></div>');
            this.getFrame().find('.frame_file_warning')[(append ? 'append' : 'html')](errors.join('<br>') + '<br>').stop(true, true).slideDown(300);
        };

        this.restoreFileInput = function () {
            var input = this.getFrame().find('input[type=file]').clone(true);
            this.getFrame().find('input[type=file]').replaceWith(input);
        };

        this.removeStageMessage = function () {
          _this.getFrame().find('.frame_file_error').remove();
        };

        this.setLoading = function () {
          this.input.addClass('_loading');
        };

        this.clearLoading = function () {
            this.input.removeClass('_loading');
            setTimeout(function () {
                _this.getFrame().find('.frame_file_error, .frame_file_warning').stop(true, true).slideUp(300);
            }, 5000);
        };
    }

    $.fn.fileFrame = function (method) {
        var response = null;
        $.each(this, function (index, item) {
            var elem = $(item);
            var fileFrame = null;
            var id = null;

            if (!elem.is('[data-file-frame]'))
            {
                id = containers.length;
                elem.attr('data-file-frame', id + '_file_frame');
                var options = {};
                if (typeof method == 'object')
                    options = method;
                fileFrame = new FileFrame(item, options);
                fileFrame.init();
                containers.push(fileFrame);
            }
            else
            {
                id = elem.attr('data-file-frame');
                fileFrame = containers[id];
            }

            if (typeof method == 'string' && fileFrame != null)
            {
                if (typeof fileFrame[method] != 'undefined')
                    response = fileFrame[method](arguments);
                else
                    console.error('Method "'+method+'" not exists in fileFrame.jquery');
            }
        });
        return response;
    }
})();
