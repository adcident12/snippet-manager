/**
 * Personal Snippet Manager - Main Application
 */
$(function () {
   // ========== Theme Management ==========
   var currentTheme = localStorage.getItem('theme') || 'dark';

   function applyTheme(theme) {
     if (theme === 'light') {
       $('html').attr('data-theme', 'light');
       $('#themeIconMoon').addClass('hidden');
       $('#themeIconSun').removeClass('hidden');
     } else {
       $('html').attr('data-theme', 'dark');
       $('#themeIconMoon').removeClass('hidden');
       $('#themeIconSun').addClass('hidden');
     }
     localStorage.setItem('theme', theme);
     currentTheme = theme;
   }

   // Initialize theme on load
   if (currentTheme === 'light') {
     $('html').attr('data-theme', 'light');
     $('#themeIconMoon').addClass('hidden');
     $('#themeIconSun').removeClass('hidden');
   } else {
     $('html').attr('data-theme', 'dark');
     $('#themeIconMoon').removeClass('hidden');
     $('#themeIconSun').addClass('hidden');
   }

   // Toggle button click handler
   $('#btnThemeToggle').on('click', function () {
     if (currentTheme === 'dark') {
       applyTheme('light');
     } else {
       applyTheme('dark');
     }
   });

   // ========== State ==========
   var currentSearch = '';
  var currentTag = '';
  var editingId = null;
  var viewingId = null;
  var deletingId = null;
  var debounceTimer = null;
  var currentViewData = null;
  var currentViewRawCode = null;
  var currentPage = 1;
  var perPage = 10;
  var totalSnippets = 0;

   // ========== API base URL ==========
   var API_BASE = 'api/';

   // ========== CSRF Token helper ==========
   function getCsrfToken() {
     // Try to get from hidden input first, then fallback to meta tag
     var $input = $('#csrfTokenInput');
     if ($input.length) return $input.val();
     var $meta = $('meta[name="csrf-token"]');
     if ($meta.length) return $meta.attr('content');
     return '';
   }

  // ========== Toast notification ==========
  function showToast(message, type) {
    type = type || 'success';
    var colors = {
      success: '#238636',
      error: '#da3633',
      info: '#1f6feb'
    };
    var icons = {
      success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };
    var $toast = $('#toast');
    var $div = $toast.find('div');
    $div.css('background', colors[type] || colors.success);
    $div.html(icons[type] || '');
    $div.append($('<span>').text(message));
    $toast.removeClass('hidden');
    setTimeout(function () { $toast.addClass('hidden'); }, 3000);
  }

  // ========== Helper: hash string to number ==========
  function strHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // ========== Language display name for UI ==========
  var langDisplayName = {
    php: 'PHP', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    css: 'CSS', html: 'HTML', sql: 'SQL', json: 'JSON',
    bash: 'Bash', shell: 'Shell', java: 'Java', cpp: 'C++',
    csharp: 'C#', go: 'Go', rust: 'Rust', markdown: 'Markdown', plaintext: 'Plain Text'
  };

  function getDisplayName(lang) {
    return langDisplayName[lang] || (lang || '').charAt(0).toUpperCase() + (lang || '').slice(1);
  }

  // ========== Escape special HTML chars (for attribute values) ==========
  function escapeAttr(str) {
    if (!str && str !== 0) return '';
    var entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, function(c) { return entities[c]; });
  }

  // ========== Render snippet card ==========
  function renderCard(snippet) {
    var tagsHtml = '';
    if (snippet.tags && snippet.tags.length > 0) {
      tagsHtml = '<div class="flex items-center gap-1 flex-wrap mt-2">' +
        snippet.tags.map(function(t) {
          var ci = strHash(t) % 6;
          return '<span data-filter-tag="' + escapeAttr(t) + '" class="tag-pill tag-color-' + ci + ' px-2 py-0.5 text-[10px] rounded cursor-pointer hover:opacity-70 transition-opacity">#' + escapeAttr(t) + '</span>';
        }).join('') +
        '</div>';
    }

    var descHtml = '';
    if (snippet.description && snippet.description.trim() !== '') {
      descHtml = '<p class="mb-2 text-sm text-[#8b949e] leading-relaxed line-clamp-5">' + escapeAttr(snippet.description) + '</p>';
    }

    var safeId = String(snippet.id);
    return '<div class="snippet-card group flex flex-col bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden hover:border-[#30363d] hover:shadow-lg hover:shadow-black/20 transition-all" data-id="' + safeId + '">' +
      '<div class="p-5 pb-3 flex-1">' +
        '<div class="flex items-start justify-between gap-3 mb-2 cursor-pointer card-header">' +
          '<h3 class="font-medium text-[#e6edf3] text-sm leading-snug flex-1 min-w-0 truncate">' + escapeAttr(snippet.title) + '</h3>' +
          '<span class="snippet-lang-badge px-2 py-0.5 text-[10px] bg-[#388bfd]/15 text-[#58a6ff] rounded whitespace-nowrap font-medium">' + getDisplayName(snippet.language) + '</span>' +
        '</div>' +
        descHtml +
        tagsHtml +
      '</div>' +
      '<div class="snippet-actions px-5 py-3 border-t border-[#21262d] flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">' +
        '<span class="text-[10px] text-[#484f58]">' + formatDateTime(snippet.created_at) + '</span>' +
        '<div class="flex items-center gap-1">' +
          '<button data-id="' + safeId + '" class="btn-view opacity-60 hover:opacity-100 text-[#8b949e] hover:text-[#58a6ff] transition-colors p-1" title="ดู"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>' +
          '<button data-id="' + safeId + '" class="btn-edit opacity-60 hover:opacity-100 text-[#8b949e] hover:text-[#58a6ff] transition-colors p-1" title="แก้ไข"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>' +
          '<button data-id="' + safeId + '" class="btn-download opacity-60 hover:opacity-100 text-[#8b949e] hover:text-[#58a6ff] transition-colors p-1" title="ดาวน์โหลด"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>' +
          '<button data-id="' + safeId + '" class="btn-delete opacity-60 hover:opacity-100 text-[#8b949e] hover:text-[#f85149] transition-colors p-1" title="ลบ"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ========== Language to file extension mapping ==========
  var extMap = {
    php: '.php', javascript: '.js', typescript: '.ts', python: '.py',
    css: '.css', html: '.html', sql: '.sql', json: '.json',
    bash: '.sh', shell: '.sh', java: '.java', cpp: '.cpp',
    csharp: '.cs', go: '.go', rust: '.rs', markdown: '.md', plaintext: '.txt'
  };

  function getExtension(lang) {
    return extMap[lang] || '.txt';
  }

  function downloadSnippet(snippet) {
    var ext = getExtension(snippet.language);
    var filename = (snippet.title || 'snippet').replace(/[^a-z0-9]/gi, '_') + ext;
    var code = snippet.code || '';
    var blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดสําเร็จ');
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  // ========== Skeleton loading cards (dynamic count) ==========
  function showSkeleton(count) {
    count = typeof count === 'number' ? count : 6;
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '<div class="skeleton-card rounded-xl p-5">' +
        '<div class="flex items-center justify-between mb-3">' +
          '<div class="h-5 w-40 rounded skeleton-shimmer"></div>' +
          '<div class="h-5 w-16 rounded skeleton-shimmer"></div>' +
        '</div>' +
        '<div class="space-y-2">' +
          '<div class="h-4 rounded w-full skeleton-shimmer"></div>' +
          '<div class="h-4 rounded w-3/4 skeleton-shimmer"></div>' +
          '<div class="h-4 rounded w-1/2 skeleton-shimmer"></div>' +
        '</div>' +
      '</div>';
    }
    $('#snippetGrid').html(html);
  }

  function hideSkeleton() {
    $('#snippetGrid').empty();
  }

  // ========== Load snippets ==========
  var loadedCount = 0;
  var isLoadingMore = false;

  function loadSnippets(reset) {
    if (reset) {
      currentSearch = '';
      $('#searchInput').val('');
      currentTag = '';
      loadedCount = 0;
      $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
    }

    var params = { limit: perPage, offset: loadedCount };
    if (currentSearch) params.q = currentSearch;
    if (currentTag) params.tag = currentTag;

    if (!isLoadingMore) {
      showSkeleton(perPage > 6 ? 6 : perPage);
      $('#pagination').addClass('hidden');
      $('#snippetCount').text('กำลังโหลด...');
    }
    $('#emptyState, #noResultsState').addClass('hidden');

    $.getJSON(API_BASE + 'snippets.php', params).done(function (res) {
      if (!res.success) return;

      var $grid = $('#snippetGrid');
      if (!isLoadingMore) $grid.empty();

      var items = res.data || [];
      totalSnippets = (res.meta && res.meta.total) ? res.meta.total : items.length;
      loadedCount += items.length;

      if (loadedCount === 0) {
        if (currentSearch || currentTag) {
          $('#noResultsState').removeClass('hidden');
          $('#emptyState').addClass('hidden');
        } else {
          $('#emptyState').removeClass('hidden');
          $('#noResultsState').addClass('hidden');
        }
      } else {
        $('#emptyState, #noResultsState').addClass('hidden');
        items.forEach(function (s, idx) {
          var $card = $(renderCard(s)).addClass('card-enter').css('animation-delay', (idx * 50) + 'ms');
          $grid.append($card);
        });
      }

      $('#snippetCount').text(loadedCount + ' จาก ' + totalSnippets + ' snippets');
      renderLoadMore();
      isLoadingMore = false;
    }).fail(function () {
      isLoadingMore = false;
      showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
    });
  }

  function loadMore() {
    isLoadingMore = true;
    var $btn = $('#btnLoadMore');
    $btn.prop('disabled', true).addClass('is-loading');
    $btn.find('.lm-text').text('กำลังโหลด...');
    loadSnippets();
  }

  // ========== Load More Button ==========
  function renderLoadMore() {
    var $pag = $('#pagination');
    $pag.empty();

    if (loadedCount >= totalSnippets) { $pag.addClass('hidden'); return; }

    var remaining = totalSnippets - loadedCount;
    var nextBatch = Math.min(remaining, perPage);
    $pag.html(
      '<button id="btnLoadMore" class="group lm-btn flex items-center gap-2.5 px-8 py-3 text-sm font-medium rounded-xl transition-all duration-200 active:scale-[0.98]">' +
        '<svg class="lm-icon w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '<span class="lm-text">โหลดเพิ่ม ' + nextBatch + ' รายการ</span>' +
        '<span class="lm-badge px-2 py-0.5 text-[10px] rounded-md">' + loadedCount + '/' + totalSnippets + '</span>' +
      '</button>'
    ).removeClass('hidden').addClass('fade-slide-up');
  }

  // ========== Load tags ==========
  function loadTags() {
    $.getJSON(API_BASE + 'tags.php').done(function (res) {
      if (!res.success) return;
      var items = res.data || [];
      var $bar = $('#tagFilterBar');
      // Keep "ทั้งหมด" button (first one), remove only tag buttons after it
      $bar.find('.tag-filter-btn').slice(1).remove();

      items.forEach(function (t) {
        $bar.append('<button data-tag="' + escapeAttr(t.name) + '" class="tag-filter-btn px-2.5 py-1 text-xs bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] rounded-md transition-colors border border-[#30363d]">#' + escapeAttr(t.name) + ' <span class="opacity-60">' + t.count + '</span></button>');
      });

      bindTagFilters();
    });
  }

  function bindTagFilters() {
    $('.tag-filter-btn').off('click').on('click', function () {
      var tag = $(this).data('tag');
      currentTag = (tag === currentTag) ? '' : tag;
      loadedCount = 0;
      if (currentTag) {
        $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
        $('[data-tag="' + escapeAttr(currentTag) + '"]').removeClass('bg-[#21262d] text-[#8b949e]').addClass('bg-[#388bfd]/20 text-[#58a6ff]');
      } else {
        $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
      }
      loadSnippets();
    });

    $(document).on('click', '.tag-pill', function (e) {
      e.stopPropagation();
      var tag = $(this).data('filter-tag');
      closeModals();
      currentTag = (tag === currentTag) ? '' : tag;
      if (currentTag) {
        $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
        $('[data-tag="' + escapeAttr(currentTag) + '"]').removeClass('bg-[#21262d] text-[#8b949e]').addClass('bg-[#388bfd]/20 text-[#58a6ff]');
      } else {
        $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
      }
      loadSnippets();
    });
  }

  // ========== Modal functions ==========
  function openAddModal() {
    editingId = null;
    $('#modalTitle').text('เพิ่ม snippet ใหม่');
    $('#editTitle').val('');
    $('#editCode').val('');
    $('#editDescription').val('');
    $('#editLanguage').val('plaintext');
    $('#editTags').val('');
    openAnyModal();
    $('#snippetModal').removeClass('hidden');
  }

  function openEditModal(id) {
    $.getJSON(API_BASE + 'snippets.php', { id: id }).done(function (res) {
      if (!res.success || !res.data) return;
      var s = res.data;
      editingId = s.id;
      $('#modalTitle').text('แก้ไข snippet');
      $('#editTitle').val(s.title);
      $('#editCode').val(s.code);
      $('#editDescription').val(s.description || '');
      $('#editLanguage').val(s.language || 'plaintext');
      $('#editTags').val((s.tags || []).join(', '));
      openAnyModal();
      $('#snippetModal').removeClass('hidden');
    });
  }

   function saveSnippet() {
     var title = $.trim($('#editTitle').val());
     var code = $('#editCode').val();
     var lang = $('#editLanguage').val();
     var tagsStr = $.trim($('#editTags').val());
     var desc = $.trim($('#editDescription').val());

     if (!title) {
       showToast('กรุณากรอกชื่อ snippet', 'error');
       $('#editTitle').focus();
       return;
     }

     // Validate input lengths before sending (client-side guard)
     if (title.length > 255) {
       showToast('ชื่อต้องไม่เกิน 255 ตัวอักษร', 'error');
       return;
     }
     if (code.length > 1048576) {
       showToast('โค้ดต้องไม่เกิน 1MB', 'error');
       return;
     }
     if (desc && desc.length > 2048) {
       showToast('คำอธิบายต้องไม่เกิน 2048 ตัวอักษร', 'error');
       return;
     }

     var tags = [];
     if (tagsStr) {
       tags = tagsStr.split(',').map(function (t) { return $.trim(t).toLowerCase(); }).filter(Boolean);
     }

     var data = { title: title, code: code, language: lang, description: desc, tags: tags };

     var method = editingId ? 'PUT' : 'POST';
     var url = API_BASE + 'snippets.php' + (editingId ? '?id=' + editingId : '');

     $.ajax({
       url: url,
       type: method,
       data: JSON.stringify(data),
       contentType: 'application/json',
       dataType: 'json',
       headers: { 'X-CSRF-Token': getCsrfToken() }
     }).done(function (res) {
      if (res.success) {
        showToast(res.message || 'บันทึกสําเร็จ');
        closeModals();
        loadSnippets(true);
        loadTags();
      } else {
        showToast(res.message || 'เกิดข้อผิดพลาด', 'error');
      }
    }).fail(function () {
      showToast('ไม่สามารถบันทึกได้', 'error');
    });
  }

  function openDeleteModal(id) {
    deletingId = id;
    openAnyModal();
    $('#deleteModal').removeClass('hidden');
  }

   function confirmDelete() {
     $.ajax({
       url: API_BASE + 'snippets.php',
       type: 'DELETE',
       contentType: 'application/json',
       dataType: 'json',
       data: JSON.stringify({ id: deletingId, csrf_token: getCsrfToken() }),
       headers: { 'X-CSRF-Token': getCsrfToken() }
     }).done(function (res) {
      if (res.success) {
        showToast(res.message);
        closeModals();
        loadSnippets(true);
        loadTags();
      } else {
        showToast(res.message || 'ลบไม่สําเร็จ', 'error');
      }
    }).fail(function () {
      showToast('ไม่สามารถลบได้', 'error');
    });
  }

  function openViewModal(id) {
    viewingId = id;
    $.getJSON(API_BASE + 'snippets.php', { id: id }).done(function (res) {
      if (!res.success || !res.data) return;
      var s = res.data;
      $('#viewTitle').text(s.title);
      $('#viewLanguage').text(getDisplayName(s.language)).removeClass('hidden');
      $('#viewDate').text(formatDateTime(s.created_at));

      var tagsHtml = '';
      if (s.tags && s.tags.length > 0) {
        tagsHtml = s.tags.map(function(t) { return '<span data-filter-tag="' + escapeAttr(t) + '" class="tag-pill px-2 py-0.5 text-[10px] bg-[#388bfd]/15 text-[#58a6ff] rounded cursor-pointer hover:bg-[#388bfd]/25">#' + escapeAttr(t) + '</span>'; }).join('');
      }
      $('#viewTags').html(tagsHtml);

      if (s.description) {
        $('#viewDescription').text(s.description).removeClass('hidden');
      } else {
        $('#viewDescription').addClass('hidden');
      }

      // Reset visibility of edit/download/copy buttons for authenticated views
      $('#btnEditFromView, #btnDownloadFromView, #btnCopySnippet').removeClass('hidden');

      // Store current view data for share token generation
      currentViewData = $.extend({}, s);

      var isMarkdown = s.language === 'markdown';

      // Markdown preview feature
      var $toggleBar = $('#markdownToggle');
      var $previewContainer = $('#markdownPreviewContainer');
      var $codeBlock = $('#viewCodeBlock');
      var $shareBtn = $('#btnShareSnippet');

      var $codeEl = $('#viewCode');

      // ALWAYS set code content first (needed for toggle between Raw/Preview)
      currentViewRawCode = s.code || '';
      $codeEl.text(currentViewRawCode);

      if (isMarkdown) {
        $toggleBar.removeClass('hidden');
        renderMarkdownPreview(currentViewRawCode);
        $codeBlock.hide();
        $previewContainer.removeClass('hidden');
        setActiveMarkdownTab('preview');
      } else {
        $toggleBar.addClass('hidden');
        $previewContainer.addClass('hidden');
        $codeEl.attr('class', 'language-' + (s.language || 'php')).removeAttr('data-highlighted');
        hljs.highlightElement($codeEl[0]);
        $codeBlock.show();
      }

      // ALWAYS show share button in view mode — it handles both "Generate Share" and "View/Unshare"
      $shareBtn.removeClass('hidden');

      openAnyModal();
      $('#viewModal').removeClass('hidden');
    });
  }

  // ========== Markdown toggle state management ==========

  function setActiveMarkdownTab(tab) {
    // tab: 'raw' | 'preview' — polished pill toggle classes
    if (tab === 'preview') {
      $('#btnMarkdownPreview').addClass('bg-[#1f6feb]/20 text-[#58a6ff] rounded-lg shadow-sm').removeClass('rounded-none bg-transparent');
      $('#btnMarkdownRaw').removeClass('bg-[#1f6feb]/20 text-[#58a6ff] rounded-lg shadow-sm').addClass('rounded-none bg-transparent hover:bg-[#21262d]/50');
    } else {
      $('#btnMarkdownRaw').addClass('bg-[#1f6feb]/20 text-[#58a6ff] rounded-lg shadow-sm').removeClass('rounded-none bg-transparent');
      $('#btnMarkdownPreview').removeClass('bg-[#1f6feb]/20 text-[#58a6ff] rounded-lg shadow-sm').addClass('rounded-none bg-transparent hover:bg-[#21262d]/50');
    }
  }

  // ========== Markdown preview helpers ==========

  function renderMarkdownPreview(markdownText) {
    if (typeof marked !== 'undefined') {
      marked.setOptions({ breaks: true });
      var mdHtml = marked.parse(markdownText || '');
      var $container = $('<div>').html(mdHtml);
      $container.find('script,iframe,object,embed,form,input,textarea,button').remove();
      $container.find('[onload],[onerror],[onclick],[onmouseover],[onfocus],[onblur]').each(function() {
        var el = this;
        $.each(el.attributes, function() { if (this && /^on/i.test(this.name)) el.removeAttribute(this.name); });
      });
      $container.find('a[href^="javascript:"]').attr('href', '#');
      $('#markdownPreview').html($container.html());
    } else {
      $('#markdownPreview').text(markdownText);
    }
  }

  function showCodeView() {
    $('#viewCodeBlock').show();
    $('#markdownPreviewContainer').addClass('hidden');
  }

  // ========== Markdown toggle handlers ==========
  $(document).on('click', '#btnMarkdownRaw', function () {
    if (!currentViewRawCode) return;
    showCodeView();
    var lang = currentViewData && currentViewData.language ? currentViewData.language : 'php';
    var $codeEl = $('#viewCode');
    // Reset: clear ALL content then re-set raw text (eliminates leftover hljs spans/text nodes)
    $codeEl.empty().text(currentViewRawCode);
    // Remove highlight.js tracking flag — must fully remove, not set to undefined (which becomes string)
    delete $codeEl[0].dataset.highlighted;
    // Reset class completely to avoid language-* classes stacking up
    $codeEl.attr('class', 'language-' + lang);
    hljs.highlightElement($codeEl[0]);
    setActiveMarkdownTab('raw');
  });

  $(document).on('click', '#btnMarkdownPreview', function () {
    if (!currentViewRawCode) return;
    renderMarkdownPreview(currentViewRawCode);
    $('#viewCodeBlock').hide();
    $('#markdownPreviewContainer').removeClass('hidden');
    setActiveMarkdownTab('preview');
  });

  // ========== Share helpers ==========
   function generateShareToken(id) {
     return $.ajax({
       url: API_BASE + 'snippets.php?action=share&id=' + id,
       type: 'PUT',
       contentType: 'application/json',
       dataType: 'json',
       headers: { 'X-CSRF-Token': getCsrfToken() }
     });
   }

   function revokeShareToken(id) {
     return $.ajax({
       url: API_BASE + 'snippets.php?action=unshare&id=' + id,
       type: 'PUT',
       contentType: 'application/json',
       dataType: 'json',
       headers: { 'X-CSRF-Token': getCsrfToken() }
     });
   }

  function openShareModal(snippet) {
    var shareUrl = window.location.origin + window.location.pathname + '?share_token=' + snippet.share_token;
    var html = '<div class="space-y-3"><p class="text-sm text-[#8b949e]">แชร์ลิงก์นี้ให้ผู้อื่น:</p>';
    html += '<input id="shareLinkInput" type="text" value="' + escapeAttr(shareUrl) + '" readonly class="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-[#58a6ff] font-mono">';
    html += '<p class="text-xs text-[#484f58]">หรือใช้ token: <code class="token-code px-1 py-0.5 bg-[#0d1117] text-white rounded font-mono">' + escapeAttr(snippet.share_token) + '</code></p>';

    if (snippet.share_token && snippet.is_public == true) {
      html += '<button id="btnUnshareSnippet" class="mt-2 text-xs text-[#f85149] hover:text-[#ff7b72] transition-colors">ยกเลิกการแชร์</button>';
    } else if (snippet.share_token) {
      html += '<span class="block mt-2 text-xs text-[#da3633]">○ ยังไม่ได้เปิดแชร์ — กำลังสร้าง token...</span>';
    } else {
      // This shouldn't happen in normal flow, but for safety:
      html += '<span class="block mt-2 text-xs text-[#da3633]">○ ยังไม่ได้แชร์ — กำลังสร้าง token...</span>';
    }
    html += '</div>';

    var modalHtml = '<div id="shareModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4"><div class="absolute inset-0 bg-black/50"></div><div class="relative w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-6"><div class="flex justify-between items-center mb-3"><h3 class="text-lg font-medium text-[#e6edf3]">แชร์ snippet</h3><button id="btnCloseShareModal" class="text-[#8b949e] hover:text-[#e6edf3] p-1"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>' + html + '<div class="flex justify-end gap-2 mt-4"><button id="btnCopyShareLink" class="px-4 py-2 text-sm bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-lg transition-colors">คัดลอกลิงก์</button></div></div></div>';
    $('#viewModal').after(modalHtml);

    // Select the input
    setTimeout(function () { $('#shareLinkInput').select(); }, 50);
  }

  function closeShareModal() {
    $('#shareModal').remove();
  }

  // Share button click handler
  $(document).on('click', '#btnShareSnippet', function () {
    if (!viewingId) return;

    // If we already have a share_token in current view, just open modal
    if (currentViewData && currentViewData.share_token) {
      openShareModal(currentViewData);
      return;
    }

    // Otherwise, generate a token first
    generateShareToken(viewingId).done(function (genRes) {
      if (genRes.success && genRes.data && genRes.data.share_token) {
        currentViewData = $.extend({}, currentViewData, { share_token: genRes.data.share_token, is_public: true });
        openShareModal(currentViewData);
      } else {
        showToast(genRes.message || 'ไม่สามารถสร้าง token ได้', 'error');
      }
    }).fail(function () {
      showToast('เกิดข้อผิดพลาด', 'error');
    });
  });

  // Close share modal
  $(document).on('click', '#btnCloseShareModal, #shareModal .bg-black\\/50', closeShareModal);

  // Copy share link
  $(document).on('click', '#btnCopyShareLink', function () {
    var $input = $('#shareLinkInput');
    $input.select();
    if (navigator.clipboard) {
      navigator.clipboard.writeText($input.val()).then(function () { showToast('คัดลอกลิงก์สําเร็จ'); });
    } else {
      document.execCommand('copy');
      showToast('คัดลอกลิงก์สําเร็จ');
    }
  });

  // Unshare snippet
  $(document).on('click', '#btnUnshareSnippet', function () {
    if (viewingId) {
      revokeShareToken(viewingId).done(function (res) {
        if (res.success) {
          showToast('ยกเลิกการแชร์แล้ว');
          closeShareModal();
          loadSnippets(true);
          // Re-open view modal to reflect changes
          openViewModal(viewingId);
        } else {
          showToast(res.message || 'ยกเลิกการแชร์ไม่สําเร็จ', 'error');
        }
      }).fail(function () {
        showToast('เกิดข้อผิดพลาด', 'error');
      });
    }
  });

  function copyCode() {
    var code = viewingId ? ($('#viewCode').text()) : ($('#editCode').val());
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(function () { showToast('คัดลอกโค้ดสําเร็จ'); }).catch(function () { fallbackCopy(code); });
    } else {
      fallbackCopy(code);
    }
  }

  function fallbackCopy(text) {
    var $ta = $('<textarea>').val(text).appendTo('body').select();
    document.execCommand('copy');
    $ta.remove();
    showToast('คัดลอกโค้ดสําเร็จ');
  }

  function closeModals() {
    $('#snippetModal, #viewModal, #deleteModal').addClass('hidden');
    document.body.style.overflow = '';
    editingId = null;
    viewingId = null;
    deletingId = null;
    currentViewData = null;
    currentViewRawCode = null;
  }

  function openAnyModal() {
    document.body.style.overflow = 'hidden';
  }

  // ========== Event bindings ==========
  function bindEvents() {
    $('#btnNewSnippet, #btnFirstSnippet').on('click', openAddModal);

    $('#btnCloseModal, #btnCancelEdit, #btnCloseView, #btnCancelDelete').on('click', closeModals);
    $('.modal-backdrop').on('click', closeModals);

    $(document).on('keydown', function (e) {
      if (e.key === 'Escape') closeModals();
    });

    $('#btnSaveSnippet').on('click', saveSnippet);
    $('#btnConfirmDelete').on('click', confirmDelete);

    $('#snippetGrid').on('click', '.snippet-card', function (e) {
      if ($(e.target).closest('.snippet-actions').length) return;
      openViewModal($(this).data('id'));
    });

    $('#snippetGrid').on('click', '.btn-view', function (e) {
      e.stopPropagation();
      openViewModal($(this).data('id'));
    });

    $('#snippetGrid').on('click', '.btn-edit', function (e) {
      e.stopPropagation();
      openEditModal($(this).data('id'));
    });

    $('#btnEditFromView').on('click', function () {
      var eid = viewingId;
      closeModals();
      setTimeout(function () { openEditModal(eid); }, 150);
    });

    $('#snippetGrid').on('click', '.btn-delete', function (e) {
      e.stopPropagation();
      openDeleteModal($(this).data('id'));
    });

    $('#btnCopySnippet').on('click', copyCode);

    $('#snippetGrid').on('click', '.btn-download', function (e) {
      e.stopPropagation();
      var id = $(this).data('id');
      $.getJSON(API_BASE + 'snippets.php', { id: id }).done(function (res) {
        if (res.success && res.data) downloadSnippet(res.data);
      });
    });

    $('#btnDownloadFromView').on('click', function () {
      if (viewingId) {
        $.getJSON(API_BASE + 'snippets.php', { id: viewingId }).done(function (res) {
          if (res.success && res.data) downloadSnippet(res.data);
        });
      }
    });

    $(document).on('click', '#btnLoadMore', function () {
      loadMore();
    });

    $('#searchInput').on('input', function () {
      clearTimeout(debounceTimer);
      var q = $(this).val();
      debounceTimer = setTimeout(function () {
        currentSearch = q;
        loadedCount = 0;
        loadSnippets();
      }, 300);
    });

    $('#btnLoadAll').on('click', function () {
      currentSearch = '';
      currentTag = '';
      $('#searchInput').val('');
      $('.tag-filter-btn').removeClass('bg-[#388bfd]/20 text-[#58a6ff]').addClass('bg-[#21262d] text-[#8b949e]');
      loadSnippets(true);
    });

    $('#searchInput').on('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        currentSearch = $(this).val();
        loadSnippets();
      }
    });
  }

  // ========== Handle public share view from URL ?share_token=xxx ==========
  var hashShare = window.location.hash.substring(1);
  if (hashShare && hashShare.indexOf('share_token=') === 0) {
    var tokenParts = hashShare.split('&');
    for (var i = 0; i < tokenParts.length; i++) {
      if (tokenParts[i].indexOf('share_token=') === 0) {
        loadSharedSnippet(decodeURIComponent(tokenParts[i].substring('share_token='.length)));
        break;
      }
    }
  }

  // Also handle ?share_token in query string
  var params = new URLSearchParams(window.location.search);
  var shareToken = params.get('share_token');
  if (shareToken) {
    loadSharedSnippet(shareToken);
  }

  function loadSharedSnippet(token) {
    $.getJSON(API_BASE + 'share.php', { share_token: token }).done(function (res) {
      if (!res.success || !res.data) return;
      var s = res.data;
      viewingId = null; // Public view mode — no editing

      $('#modalTitle').text('Public Snippet');
      $('#viewTitle').text(s.title);
      $('#viewLanguage').text(getDisplayName(s.language)).removeClass('hidden');
      $('#viewDate').text('Shared on ' + formatDateTime(s.created_at));

      var tagsHtml = '';
      if (s.tags && s.tags.length > 0) {
        tagsHtml = s.tags.map(function(t) { return '<span class="tag-pill px-2 py-0.5 text-[10px] bg-[#388bfd]/15 text-[#58a6ff] rounded">#' + escapeAttr(t) + '</span>'; }).join('');
      }
      $('#viewTags').html(tagsHtml);

      if (s.description) {
        $('#viewDescription').text(s.description).removeClass('hidden');
      } else {
        $('#viewDescription').addClass('hidden');
      }

      var isMarkdown = s.language === 'markdown';

      // Store for toggle use
      currentViewData = $.extend({}, s);

      var $toggleBar = $('#markdownToggle');
      var $previewContainer = $('#markdownPreviewContainer');
      var $codeBlock = $('#viewCodeBlock');
      var $codeEl = $('#viewCode');

      // Store raw code for toggle use
      currentViewRawCode = s.code || '';

      // ALWAYS set code content first (needed for toggle between Raw/Preview)
      $codeEl.text(currentViewRawCode);

      if (isMarkdown) {
        $toggleBar.removeClass('hidden');
        renderMarkdownPreview(currentViewRawCode);
        $codeBlock.hide();
        $previewContainer.removeClass('hidden');
        setActiveMarkdownTab('preview');
      } else {
        $toggleBar.addClass('hidden');
        $previewContainer.addClass('hidden');
        $codeEl.attr('class', 'language-' + (s.language || 'php')).removeAttr('data-highlighted');
        hljs.highlightElement($codeEl[0]);
        $codeBlock.show();
      }

      // Hide authenticated-view editing buttons in public share mode
      $('#btnEditFromView, #btnDownloadFromView, #btnCopySnippet').addClass('hidden');

      openAnyModal();
      $('#viewModal').removeClass('hidden');
    }).fail(function () {
      showToast('ไม่สามารถโหลด snippet ที่แชร์ได้', 'error');
    });
  }

  // ========== Load CSRF token from server on init ==========
  function loadCsrfToken(callback) {
    $.getJSON(API_BASE + 'snippets.php', { _csrf: '1' }).done(function (res) {
      if (res && res.csrf_token) {
        var token = res.csrf_token;
        $('#csrfTokenInput').val(token);
        $('meta[name="csrf-token"]').attr('content', token);
      }
      if (callback) callback();
    }).fail(function () {
      if (callback) callback();
    });
  }

  // ========== Initialize ==========
  bindEvents();
  loadCsrfToken(function () {
    loadSnippets(true);
    loadTags();
  });
});
