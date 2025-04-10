  // @charset UTF-8
// 导出报告模块

// 全局变量，防止重复初始化和重复上传
let isTemplateUploaderInitialized = false;
let isTemplateUploading = false;
let templateContent = null;
let templateFile = null;
let currentExportRequestId = null; // 用于跟踪当前导出请求ID
let abortController = null; // 用于取消请求

document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化导出页面开始...');
    
    // 初始化导出设置
    initExportSettings();
    
    // 初始化模板选择
    initTemplateSelection();
    
    // 初始化学生列表
    initStudentList();
    
    // 首先尝试获取模板上传按钮和文件输入元素
    const uploadBtn = document.getElementById('uploadTemplateBtn');
    const fileInput = document.getElementById('templateUpload');
    console.log('模板上传按钮存在:', !!uploadBtn, '文件输入存在:', !!fileInput);
    
    // 检查是否已初始化
    console.log('模板上传初始化状态:', isTemplateUploaderInitialized);
    
    // 只在没有初始化的情况下执行模板上传初始化
    if (!isTemplateUploaderInitialized) {
        console.log('即将初始化模板上传功能...');
        initTemplateUpload();
    } else {
        console.log('模板上传已初始化，跳过');
    }
    
    // 检查初始化后的状态
    console.log('模板上传初始化后状态:', isTemplateUploaderInitialized);
    
    // 绑定设置相关的事件处理
    bindSettingsEvents();
    
    // 初始化预览
    updatePreview();
    
    // 监听自定义模板选择事件
    document.addEventListener('template-selected', function(e) {
        if (e.detail && e.detail.templateId) {
            console.log('收到模板选择事件:', e.detail.templateId);
            updatePreview();
        }
    });
    
    // 初始化导出功能
    initExportFunctions();
    
    console.log('导出页面初始化完成');
});

// 初始化导出设置
function initExportSettings() {
    // 获取本地存储的导出设置或使用默认值
    const settings = dataService.getExportSettings();
    
    // 先从系统设置获取学期配置
    fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' || data.status === 'ok') {
                const serverSettings = data.data || data.settings || {};
                
                // 更新学年和学期信息
                if (serverSettings.school_year || serverSettings.schoolYear) {
                    // 优先使用设置中的学年信息
                    const schoolYear = serverSettings.school_year || serverSettings.schoolYear;
                    document.getElementById('schoolYear').value = schoolYear;
                    settings.schoolYear = schoolYear;
                } else {
                    // 使用默认学年，确保与首页一致
                    document.getElementById('schoolYear').value = "2024-2025";
                    settings.schoolYear = "2024-2025";
                }
                
                if (serverSettings.semester) {
                    let semesterText = '第一学期';
                    let semesterValue = '1';
                    
                    if (serverSettings.semester === '第二学期' || serverSettings.semester === '下学期' || serverSettings.semester === '2') {
                        semesterText = '第二学期';
                        semesterValue = '2';
                    }
                    
                    // 更新显示文本和隐藏值
                    const semesterInput = document.getElementById('semester');
                    const semesterValueInput = document.getElementById('semesterValue');
                    
                    if (semesterInput) semesterInput.value = semesterText;
                    if (semesterValueInput) semesterValueInput.value = semesterValue;
                    
                    settings.semester = semesterValue;
                    settings.semesterText = semesterText;
                } else {
                    // 使用默认学期，确保与首页一致
                    const semesterInput = document.getElementById('semester');
                    const semesterValueInput = document.getElementById('semesterValue');
                    
                    if (semesterInput) semesterInput.value = "第二学期";
                    if (semesterValueInput) semesterValueInput.value = "2";
                    
                    settings.semester = "2";
                    settings.semesterText = "第二学期";
                }
                
                // 根据学期设置合适的开学时间
                if (document.getElementById('startDate')) {
                    const currentYear = new Date().getFullYear();
                    let defaultStartDate;
                    
                    if (settings.semester === '1') {
                        // 第一学期默认开学时间：9月1日
                        defaultStartDate = `${currentYear}-09-01`;
                    } else {
                        // 第二学期默认开学时间：3月1日
                        defaultStartDate = `${currentYear}-03-01`;
                    }
                    
                    // 如果没有特别设置过开学时间，用默认值
                    if (!settings.startDate) {
                        settings.startDate = defaultStartDate;
                    }
                    
                    document.getElementById('startDate').value = settings.startDate;
                }
                
                // 保存更新后的设置
                dataService.saveExportSettings(settings);
                
                // 更新预览
                updatePreview();
            } else {
                // 设置默认学年学期
                setDefaultSemesterInfo(settings);
            }
        })
        .catch(error => {
            console.error('获取系统设置失败:', error);
            showNotification('获取学期信息失败，将使用默认设置', 'warning');
            
            // 设置默认学年学期
            setDefaultSemesterInfo(settings);
        });
    
    // 设置默认值
    document.getElementById('schoolYear').value = settings.schoolYear || "2024-2025";
    document.getElementById('semester').value = settings.semester === '1' ? '第一学期' : '第二学期';
    document.getElementById('semesterValue').value = settings.semester || "2";
    
    // 设置开学时间
    if (document.getElementById('startDate')) {
        document.getElementById('startDate').value = settings.startDate || '';
    }
    
    // 设置包含内容复选框
    document.getElementById('includeBasicInfo').checked = settings.includeBasicInfo !== false;
    document.getElementById('includeGrades').checked = settings.includeGrades !== false;
    document.getElementById('includeComments').checked = settings.includeComments !== false;
    
    // 设置文件命名格式
    const fileNameFormatSelect = document.getElementById('fileNameFormat');
    if (fileNameFormatSelect) {
        fileNameFormatSelect.value = settings.fileNameFormat || 'id_name';
    }
    
    // 设置班主任姓名
    const teacherNameInput = document.getElementById('teacherName');
    if (teacherNameInput) {
        teacherNameInput.value = settings.teacherName || '肖老师';
    }
}

// 设置默认学期信息
function setDefaultSemesterInfo(settings) {
    // 设置默认学年为2024-2025
    document.getElementById('schoolYear').value = "2024-2025";
    settings.schoolYear = "2024-2025";
    
    // 设置默认学期为下学期
    const semesterInput = document.getElementById('semester');
    const semesterValueInput = document.getElementById('semesterValue');
    
    if (semesterInput) semesterInput.value = "第二学期";
    if (semesterValueInput) semesterValueInput.value = "2";
    
    settings.semester = "2";
    settings.semesterText = "第二学期";
    
    // 设置默认开学时间
    const currentYear = new Date().getFullYear();
    const defaultStartDate = `${currentYear}-03-01`;
    
    if (document.getElementById('startDate')) {
        if (!settings.startDate) {
            settings.startDate = defaultStartDate;
        }
        document.getElementById('startDate').value = settings.startDate;
    }
    
    // 保存更新后的设置
            dataService.saveExportSettings(settings);
    
    // 更新预览
    updatePreview();
}

// 选择模板
function selectTemplate(templateCard) {
    // 移除其他模板的选中状态
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.classList.remove('selected');
    });
    
    // 设置当前模板为选中状态
    templateCard.classList.add('selected');
    
    // 更新导出设置
    const template = templateCard.dataset.template;
    dataService.updateExportSettings({ template });
    
    // 更新预览
    updatePreview();
}

// 初始化学生列表
function initStudentList() {
    const studentListContainer = document.querySelector('.student-list');
    if (!studentListContainer) return;
    
    // 显示加载状态
    studentListContainer.innerHTML = '<div class="text-center p-3">正在加载学生数据...</div>';
    
    // 从服务器获取学生数据
    fetch('/api/students')
        .then(response => {
            if (!response.ok) {
                throw new Error('服务器响应错误: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            // 检查数据结构
            const students = Array.isArray(data) ? data : 
                             (data.students && Array.isArray(data.students)) ? data.students : 
                             (data.status === 'ok' && data.data && Array.isArray(data.data)) ? data.data : null;
            
            if (!students || students.length === 0) {
                studentListContainer.innerHTML = '<div class="text-center p-3">暂无学生数据</div>';
                return;
            }
            
            // 保存学生数据到本地服务
            dataService.setStudents(students);
            
            // 清空容器
            studentListContainer.innerHTML = '';
    
    // 创建学生项
    students.forEach(student => {
                const studentItem = document.createElement('div');
                studentItem.className = 'student-item';
                // 设置数据属性用于排序
                studentItem.dataset.studentId = student.id;
                studentItem.dataset.studentName = student.name;
                
                studentItem.innerHTML = `
                    <input type="checkbox" class="form-check-input student-checkbox" data-id="${student.id}" checked>
            <div class="student-avatar">
                <i class='bx bx-user'></i>
            </div>
            <div>
                <div class="student-name">${student.name}</div>
                <div class="student-id">学号: ${student.id}</div>
            </div>
        `;
                studentListContainer.appendChild(studentItem);
                
                // 绑定复选框事件
                const checkbox = studentItem.querySelector('.student-checkbox');
                checkbox.addEventListener('change', updateSelectAllCheckbox);
            });
            
            // 应用初始排序 - 默认按学号排序
            sortStudentList('id');
            
            // 更新全选复选框状态
            updateSelectAllCheckbox();
        })
        .catch(error => {
            console.error('加载学生列表失败:', error);
            studentListContainer.innerHTML = `<div class="text-center p-3 text-danger">加载失败: ${error.message}</div>`;
            
            // 尝试使用本地缓存的学生数据
            const cachedStudents = dataService.getStudents();
            if (cachedStudents && cachedStudents.length > 0) {
                showNotification('使用本地缓存的学生数据显示', 'info');
                renderStudentList(cachedStudents, studentListContainer);
            }
        });
}

// 渲染学生列表
function renderStudentList(students, container) {
    if (!container) container = document.querySelector('.student-list');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 创建学生项
    students.forEach(student => {
        const studentItem = document.createElement('div');
        studentItem.className = 'student-item';
        // 设置数据属性用于排序
        studentItem.dataset.studentId = student.id;
        studentItem.dataset.studentName = student.name;
        
        studentItem.innerHTML = `
            <input type="checkbox" class="form-check-input student-checkbox" data-id="${student.id}" checked>
            <div class="student-avatar">
                <i class='bx bx-user'></i>
            </div>
            <div>
                <div class="student-name">${student.name}</div>
                <div class="student-id">学号: ${student.id}</div>
            </div>
        `;
        container.appendChild(studentItem);
        
        // 绑定复选框事件
        const checkbox = studentItem.querySelector('.student-checkbox');
        checkbox.addEventListener('change', updateSelectAllCheckbox);
    });
    
    // 更新全选复选框状态
    updateSelectAllCheckbox();
}

// 切换全选学生
function toggleSelectAllStudents(checked) {
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    studentCheckboxes.forEach(checkbox => {
        checkbox.checked = checked;
    });
}

// 更新全选复选框状态
function updateSelectAllCheckbox() {
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllStudents');
    
    if (!selectAllCheckbox) return;
    
    const checkedCount = Array.from(studentCheckboxes).filter(checkbox => checkbox.checked).length;
    
    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === studentCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// 排序学生列表
function sortStudentList(sortBy) {
    const studentList = document.querySelector('.student-list');
    if (!studentList) return;
    
    // 获取所有学生项
    const studentItems = Array.from(studentList.querySelectorAll('.student-item'));
    
    // 排序学生项
    studentItems.sort((a, b) => {
        if (sortBy === 'name') {
            return a.dataset.studentName.localeCompare(b.dataset.studentName, 'zh-CN');
        } else {
            return parseInt(a.dataset.studentId) - parseInt(b.dataset.studentId);
        }
    });
    
    // 重新添加到列表
    studentItems.forEach(item => {
        studentList.appendChild(item);
    });
}

// 更新导出设置并保存
function updateExportSettings() {
    // 获取当前设置
    const settings = {
        schoolYear: document.getElementById('schoolYear') ? document.getElementById('schoolYear').value : '',
        semester: document.getElementById('semesterValue') ? document.getElementById('semesterValue').value : '1',
        semesterText: document.getElementById('semester') ? document.getElementById('semester').value : '第一学期',
        startDate: document.getElementById('startDate') ? document.getElementById('startDate').value : '',
        includeBasicInfo: document.getElementById('includeBasicInfo') ? document.getElementById('includeBasicInfo').checked : true,
        includeGrades: document.getElementById('includeGrades') ? document.getElementById('includeGrades').checked : true,
        includeComments: document.getElementById('includeComments') ? document.getElementById('includeComments').checked : true,
        fileNameFormat: document.getElementById('fileNameFormat') ? document.getElementById('fileNameFormat').value : 'id_name',
        teacherName: document.getElementById('teacherName') ? document.getElementById('teacherName').value : '肖老师',
        exportDate: formatDate(new Date())
    };
    
    // 保存到本地存储
    dataService.saveExportSettings(settings);
    
    return settings;
}

// 更新预览
function updatePreview() {
    const previewContainer = document.querySelector('.report-preview');
    if (!previewContainer) return;
    
    try {
    // 获取导出设置
    const settings = dataService.getExportSettings();
    
    // 获取学生数据、评语数据和成绩数据
    const students = dataService.getStudents();
        if (!students || students.length === 0) {
        previewContainer.innerHTML = '<div class="text-center p-5">暂无学生数据</div>';
        return;
    }
    
    // 使用第一个学生作为预览
    const student = students[0];
        if (!student) {
            previewContainer.innerHTML = '<div class="text-center p-5">学生数据不完整</div>';
            return;
        }
        
        // 安全地获取学生ID和评语
        const studentId = student.id || '';
        const comment = studentId ? dataService.getCommentByStudentId(studentId) : null;
        const grade = studentId ? dataService.getGradeByStudentId(studentId) : null;
    const subjects = dataService.getSubjects();
    
    // 创建预览内容
    let previewHTML = `
        <div class="report-header">
                <div class="report-title">${settings.schoolName || '学校名称'}学生综合素质发展报告单</div>
                <div class="report-subtitle">${settings.schoolYear || ''}学年 第${settings.semester || ''}学期</div>
        </div>
        
        <div class="report-info">
                <div><strong>班级：</strong>${settings.className || ''}</div>
                <div><strong>姓名：</strong>${student.name || ''}</div>
                <div><strong>学号：</strong>${studentId}</div>
                <div><strong>日期：</strong>${settings.exportDate || ''}</div>
        </div>
    `;
    
    // 基本信息部分
    if (settings.includeBasicInfo) {
        previewHTML += `
            <div class="report-section">
                <div class="report-section-title">基本信息</div>
                <div class="row">
                        <div class="col-md-6"><strong>性别：</strong>${student.gender || ''}</div>
                        <div class="col-md-6"><strong>出生日期：</strong>${student.birthdate || ''}</div>
                </div>
                <div class="row mt-2">
                        <div class="col-md-6"><strong>家长电话：</strong>${student.parentPhone || ''}</div>
                        <div class="col-md-6"><strong>家庭住址：</strong>${student.address || ''}</div>
                </div>
            </div>
        `;
    }
    
    // 成绩部分
    if (settings.includeGrades) {
        previewHTML += `
            <div class="report-section">
                <div class="report-section-title">学科成绩</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            ${subjects.map(subject => `<th>${subject}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${subjects.map(subject => `<td>${grade && grade.grades[subject] ? grade.grades[subject] : '-'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // 评语部分
    if (settings.includeComments) {
        previewHTML += `
            <div class="report-section">
                <div class="report-section-title">综合评语</div>
                <p>${comment ? comment.content : '暂无评语'}</p>
            </div>
        `;
    }
    
    // 考勤部分（示例）
    if (settings.includeAttendance) {
        previewHTML += `
            <div class="report-section">
                <div class="report-section-title">考勤情况</div>
                <div class="row">
                    <div class="col-md-4"><strong>应到天数：</strong>90天</div>
                    <div class="col-md-4"><strong>实到天数：</strong>88天</div>
                    <div class="col-md-4"><strong>出勤率：</strong>97.8%</div>
                </div>
                <div class="row mt-2">
                    <div class="col-md-4"><strong>请假：</strong>2天</div>
                    <div class="col-md-4"><strong>迟到：</strong>1次</div>
                    <div class="col-md-4"><strong>早退：</strong>0次</div>
                </div>
            </div>
        `;
    }
    
    // 奖励部分（示例）
    if (settings.includeAwards) {
        previewHTML += `
            <div class="report-section">
                <div class="report-section-title">获奖情况</div>
                <ul>
                    <li>三好学生</li>
                    <li>数学竞赛三等奖</li>
                </ul>
            </div>
        `;
    }
    
    // 签名部分
    previewHTML += `
        <div class="report-section mt-5">
            <div class="row">
                <div class="col-md-6 text-center">
                    <div><strong>班主任签名：</strong>_______________</div>
                </div>
                <div class="col-md-6 text-center">
                    <div><strong>家长签名：</strong>_______________</div>
                </div>
            </div>
        </div>
    `;
    
        // 设置预览内容
    previewContainer.innerHTML = previewHTML;
    } catch (error) {
        console.error('生成预览时出错:', error);
        previewContainer.innerHTML = '<div class="text-center p-5 text-danger">生成预览时出错</div>';
    }
}

// 显示预览
function showPreview() {
    // 更新预览
    updatePreview();
    
    // 显示预览模态框
    const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
    previewModal.show();
}

// 获取选中的学生
function getSelectedStudents() {
    const selectedIds = [];
    const studentCheckboxes = document.querySelectorAll('.student-checkbox');
    studentCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const studentId = checkbox.dataset.id;
            if (studentId) {
                selectedIds.push(studentId);
            }
        }
    });
    
    return selectedIds; // 直接返回ID列表，而不是学生对象列表
}

// 初始化文件上传处理
function initTemplateUpload() {
    // 防止重复初始化
    if (isTemplateUploaderInitialized) {
        console.log('模板上传已初始化，跳过');
        return;
    }
    
    console.log('开始初始化模板上传功能...');
    
    try {
        // 获取元素引用
        const uploadBtn = document.getElementById('uploadTemplateBtn');
        const fileInput = document.getElementById('templateUpload');
        
        // 如果元素不存在，直接返回
        if (!uploadBtn || !fileInput) {
            console.warn('找不到上传按钮或文件输入元素，模板上传初始化失败');
            return;
        }
        
        // 先移除所有存在的点击事件（如果有的话）
        if (typeof uploadBtn._clickEvent === 'function') {
            console.log('检测到已存在的点击事件处理程序，移除它');
            uploadBtn.removeEventListener('click', uploadBtn._clickEvent);
            delete uploadBtn._clickEvent;
        }
        
        // 移除所有现有的事件监听器（通过克隆节点）
        const newUploadBtn = uploadBtn.cloneNode(true);
        uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
        
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // 重新获取引用
        const freshUploadBtn = document.getElementById('uploadTemplateBtn');
        const freshFileInput = document.getElementById('templateUpload');
        
        if (!freshUploadBtn || !freshFileInput) {
            console.warn('克隆后找不到元素，模板上传初始化失败');
            return;
        }
        
        // 直接绑定点击事件，不使用事件委托
        const handleUploadBtnClick = function(e) {
            console.log('上传按钮被点击');
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
            
            // 检查状态，防止重复触发
            if (isTemplateUploading) {
                console.log('上传已在进行中，忽略点击');
                return false;
            }
            
            console.log('触发文件选择对话框');
            isTemplateUploading = true;
            
            // 触发文件选择
            freshFileInput.click();
            
            // 一秒后重置状态
            setTimeout(() => {
                isTemplateUploading = false;
                console.log('重置上传状态，允许再次上传');
            }, 1000);
            
            return false; // 阻止默认行为
        };
        
        // 存储函数引用以便以后可以移除
        freshUploadBtn._clickEvent = handleUploadBtnClick;
        
        // 确保只绑定一次事件 - 使用onclick而不是addEventListener
        freshUploadBtn.onclick = handleUploadBtnClick;
        console.log('成功绑定上传按钮点击事件');
        
        // 处理文件选择变更
        const handleFileChange = function(e) {
            console.log('文件选择变更');
            if (this.files && this.files.length > 0) {
                handleTemplateUpload(e);
            } else {
                console.log('未选择文件或取消了选择');
                isTemplateUploading = false;
            }
            
            // 重置文件输入，确保可以重新选择相同文件
            setTimeout(() => {
                this.value = '';
                console.log('清除文件输入框的值，以便可以重新选择相同文件');
            }, 100);
        };
        
        // 确保只绑定一次事件 - 使用onchange而不是addEventListener
        freshFileInput.onchange = handleFileChange;
        console.log('成功绑定文件输入变更事件');
        
        // 标记为已初始化
        isTemplateUploaderInitialized = true;
        console.log('模板上传初始化完成');
    } catch (error) {
        console.error('初始化模板上传时出错:', error);
    }
}

// 处理模板文件上传
async function handleTemplateUpload(event) {
    try {
        console.log('开始处理上传的文件...');
        
        // 防止重复处理
        if (event.isHandled) {
            console.log('该事件已被处理过，跳过');
            return;
        }
        
        // 标记事件已处理
        event.isHandled = true;
        
        // 获取文件
        const file = event.target.files && event.target.files[0];
        if (!file) {
            console.warn('未选择任何文件');
            isTemplateUploading = false;
            return;
        }
        
        console.log('选择的文件:', file.name, '类型:', file.type, '大小:', file.size, 'bytes');
        
        // 验证文件类型
        if (!file.name.toLowerCase().endsWith('.docx')) {
            console.warn('文件类型不正确，要求.docx格式');
            showNotification('请上传.docx格式的文件', 'error');
            isTemplateUploading = false;
            return;
        }
        
        // 保存文件引用
        templateFile = file;
        
        // 更新UI显示已选择的模板
        const templateNameElement = document.getElementById('templateName');
        if (templateNameElement) {
            templateNameElement.textContent = file.name;
        }
        
        // 更新自定义模板状态
        const customTemplateCard = document.querySelector('.template-card[data-template="custom"]');
        if (customTemplateCard) {
            customTemplateCard.classList.remove('disabled');
            selectTemplate(customTemplateCard);
        }
        
        // 显示已选择的模板信息
        const uploadedTemplate = document.getElementById('uploadedTemplate');
        if (uploadedTemplate) {
            uploadedTemplate.classList.remove('d-none');
        }
        
        // 隐藏默认模板信息
        const defaultTemplate = document.getElementById('defaultTemplate');
        if (defaultTemplate) {
            defaultTemplate.classList.add('d-none');
        }
        
        // 显示成功通知
        showNotification('模板上传成功！', 'success');
        console.log('模板文件上传成功处理完成');
    } catch (error) {
        console.error('处理模板上传时出错:', error);
        showNotification('模板上传处理失败:' + error.message, 'error');
    } finally {
        // 确保无论如何都重置上传状态
        isTemplateUploading = false;
    }
}

// 在PDF导出完成后，确保清除所有模态框和背景遮罩
function clearAllModals() {
    // 清除所有可能的模态框
    const modalIds = ['pdfConfirmModal', 'progressModal', 'exportCompleteModal'];
    
    modalIds.forEach(id => {
        const modalElement = document.getElementById(id);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
    });
    
    // 手动移除所有可能存在的遮罩层
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
    });
    
    // 移除body上可能添加的modal-open类
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

// 修改导出完成的处理函数，确保清除模态框
async function exportReports(exportType = 'word') {
    try {
        // 生成唯一的请求ID
        currentExportRequestId = Date.now().toString();
        // 创建新的AbortController用于取消请求
        abortController = new AbortController();
        
        // 显示加载状态
        const exportBtn = document.getElementById(exportType === 'pdf' ? 'exportPdfBtn' : 'exportBtn');
        if (exportBtn) {
            // 如果按钮已经禁用，说明正在导出，防止重复点击
            if (exportBtn.disabled) {
                return;
            }
            
            exportBtn.disabled = true;
            exportBtn.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> 导出${exportType === 'pdf' ? 'PDF' : 'Word'}中...`;
        }
        
        // 安全获取DOM元素值的辅助函数
        const getElementValue = (id, defaultValue = '') => {
            const element = document.getElementById(id);
            return element ? element.value || defaultValue : defaultValue;
        };
        
        // 安全获取复选框状态的辅助函数
        const getCheckboxState = (id, defaultValue = false) => {
            const element = document.getElementById(id);
            return element ? element.checked : defaultValue;
        };
        
        // 获取所选学生ID列表
        const selectedStudentIds = getSelectedStudents();
        console.log('选中的学生IDs:', selectedStudentIds);
        if (selectedStudentIds.length === 0) {
            showNotification('请至少选择一个学生进行导出', 'warning');
            resetExportButton(exportType);
            return;
        }
        
        // 直接使用泉州东海湾实验学校综合素质发展报告单作为模板ID
        const templateId = '泉州东海湾实验学校综合素质发展报告单';
        console.log('使用模板ID:', templateId);
                
        // 收集导出设置
        const settings = {
            schoolYear: getElementValue('schoolYear', '2024-2025'),
            semester: getElementValue('semester', '第二学期'),
            fileNameFormat: getElementValue('fileNameFormat', 'id_name'),
            startDate: getElementValue('startDate', ''),
            schoolName: getElementValue('schoolName', ''),
            className: getElementValue('className', ''),
            teacherName: getElementValue('teacherName', ''),
            exportType: exportType // 添加导出类型参数
        };
        console.log('导出设置:', settings);
        
        // 显示进度模态窗口
        const progressModal = new bootstrap.Modal(document.getElementById('progressModal'));
        
        // 绑定取消按钮事件
        const cancelBtn = document.getElementById('progressModal').querySelector('.modal-footer .btn-secondary');
        if (cancelBtn) {
            // 移除之前的事件监听器
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // 添加新的事件监听器
            newCancelBtn.addEventListener('click', function() {
                cancelExport(currentExportRequestId);
            });
        }
        
        progressModal.show();
            
        // 更新进度
        updateProgress(10, exportType === 'pdf' ? '正在准备PDF导出...' : '正在准备导出...');
        
        try {
            // 防止重复请求
            if (window.isExporting) {
                console.log('已有导出请求正在进行中');
                return;
            }
            
            window.isExporting = true;
            
            // 发送请求到服务器
            updateProgress(30, exportType === 'pdf' ? '正在生成报告并准备转换...' : '正在生成报告...');
            console.log('正在向服务器发送请求...');
            console.log('导出类型:', exportType);
            console.log('导出设置:', settings);

            const response = await fetch('/api/export-reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, application/zip', // 接受JSON或ZIP文件
                    'X-Export-Request-ID': currentExportRequestId // 添加请求ID到头部
                },
                body: JSON.stringify({
                    studentIds: selectedStudentIds,
                    templateId: templateId,
                    settings: {
                        ...settings,
                        exportType: exportType // 确保导出类型被包含在settings中
                    }
                }),
                signal: abortController.signal // 使用AbortController信号
            });
            
            // 请求完成，重置标志
            window.isExporting = false;
            
            // 更新进度
            updateProgress(60, exportType === 'pdf' ? '正在将Word转换为PDF...' : '正在处理响应...');
            console.log('服务器响应状态:', response.status);
            console.log('服务器响应类型:', response.headers.get('Content-Type'));
            
            // 检查响应是否成功
            if (!response.ok) {
                // 尝试读取错误信息
                let errorMessage = '服务器返回错误状态: ' + response.status;
                try {
                    const errorData = await response.text();
                    errorMessage = errorData || errorMessage;
                } catch (e) {
                    console.error('读取错误响应失败:', e);
                }
                
                throw new Error(errorMessage);
            }
            
            // 检查是否是直接文件下载
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/zip')) {
                console.log('检测到ZIP文件响应，直接下载');
                updateProgress(80, exportType === 'pdf' ? '正在准备下载PDF文件...' : '准备下载文件...');
                
                // 下载文件
                const blob = await response.blob();
                updateProgress(90, exportType === 'pdf' ? '正在下载PDF文件...' : '正在下载文件...');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `student_reports_${exportType}_` + new Date().toISOString().slice(0,10) + '.zip';
                document.body.appendChild(a);
                a.click();
                
                // 清理
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    window.isExporting = false; // 确保导出状态被重置
                }, 100);
                
                updateProgress(100, '导出完成!', 'success');
                
                // 延迟一秒后关闭进度条，让用户看到100%完成状态
                setTimeout(() => {
                    // 隐藏进度模态框
                    hideProgressModal();
                    
                    // 显示完成模态框
                    showExportCompleteModal(
                        `${exportType === 'pdf' ? 'PDF' : 'Word'}导出成功`, 
                        `已成功导出${selectedStudentIds.length}份学生报告！`, 
                        'success'
                    );
                    
                    // 重置导出按钮
                    resetExportButton(exportType);
                }, 1000);
                
                return;
            }
            
            // 如果不是文件下载，尝试解析JSON响应
            try {
                updateProgress(80, '处理服务器响应...');
                
                // 先检查响应内容是否为空
                const clonedResponse = response.clone(); // 克隆响应以便多次读取
                const responseText = await clonedResponse.text();
                
                // 如果响应为空但响应状态码是200，可能是成功的二进制文件下载
                if ((!responseText || responseText.trim() === '') && response.ok) {
                    console.log('服务器返回了空响应但状态码为200，可能是文件已经成功下载');
                    updateProgress(100, '导出完成!');
                    
                    // 检查PDF转换失败的特殊头信息
                    const pdfConversionFailed = response.headers.get('X-PDF-Conversion-Failed');
                    if (pdfConversionFailed === 'true' && exportType === 'pdf') {
                        // 延迟关闭进度条
                        setTimeout(() => {
                            if (progressModal) {
                                progressModal.hide();
                            }
                            showNotification('PDF转换失败，但已成功导出Word版本报告', 'warning');
                        }, 1000);
                    } else {
                        // 延迟关闭进度条
                        setTimeout(() => {
                            if (progressModal) {
                                progressModal.hide();
                            }
                            showNotification('报告导出成功', 'success');
                        }, 1000);
                    }
                    
                    resetExportButton(exportType);
                    return;
                } else if (!responseText || responseText.trim() === '') {
                    // 真正的空响应错误
                    throw new Error('服务器返回了空响应');
                }
                
                // 尝试解析JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (jsonError) {
                    // 如果无法解析为JSON但响应状态码是200，可能是文件已经成功下载
                    if (response.ok) {
                        console.log('JSON解析错误，但状态码为200，可能是文件已经成功下载');
                        updateProgress(100, '导出完成!');
                        
                        setTimeout(() => {
                            if (progressModal) {
                                progressModal.hide();
                            }
                            showNotification('报告导出成功', 'success');
                        }, 1000);
                        
                        resetExportButton(exportType);
                        return;
                    }
                    
                    console.error('JSON解析错误:', jsonError, '响应内容:', responseText);
                    throw new Error('解析服务器响应失败: ' + jsonError.message);
                }
                
                console.log('服务器JSON响应:', result);
                
                if (result.status === 'error') {
                    throw new Error(result.message || '导出报告失败');
                }
                
                // 处理警告状态 - 当PDF转换失败但提供了Word版本时
                if (result.status === 'warning') {
                    // 从服务器下载生成的文件
                    updateProgress(90, '正在下载文件...');
                    console.log('正在下载文件:', result.filename);
                    const downloadUrl = `https://${window.location.host}/download/exports/${result.filename}`;
                    
                    // 创建下载链接并触发下载
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = result.filename; 
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    
                    // 等待一段时间后再移除元素
                    setTimeout(() => {
                        a.remove();
                    }, 1000);
                    
                    updateProgress(100, '导出完成!');
                    
                    // 延迟一秒后关闭进度条，让用户看到100%完成状态
                    setTimeout(() => {
                        if (progressModal) {
                            progressModal.hide();
                        }
                        showNotification(result.message || 'PDF转换失败，但已成功导出Word版本报告', 'warning');
                    }, 1000);
                    
                    resetExportButton(exportType);
                    return;
                }
                
                if (result.status === 'ok' && result.filename) {
                    // 从服务器下载生成的文件
                    updateProgress(90, '正在下载文件...');
                    console.log('正在下载文件:', result.filename);
                    const downloadUrl = `https://${window.location.host}/download/exports/${result.filename}`;
                    
                    // 创建下载链接并触发下载
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = result.filename; 
                    a.target = '_blank'; // 在新标签页中打开
                    document.body.appendChild(a);
                    a.click();
                    
                    // 等待一段时间后再移除元素
                    setTimeout(() => {
                        a.remove();
                    }, 1000);
                    
                    updateProgress(100, '导出完成!');
                    
                    // 延迟一秒后关闭进度条，让用户看到100%完成状态
                    setTimeout(() => {
                        if (progressModal) {
                            progressModal.hide();
                        }
                        showNotification(result.message || '报告导出成功', 'success');
                    }, 1000);
                } else {
                    throw new Error('服务器未返回有效的下载信息');
                }
            } catch (jsonError) {
                console.error('处理JSON响应时出错:', jsonError);
                updateProgress(100, '导出失败: ' + jsonError.message, 'error');
                
                // 延迟一秒后关闭进度条，让用户看到错误状态
                setTimeout(() => {
                    if (progressModal) {
                        progressModal.hide();
                    }
                }, 1500);
                
                throw new Error('导出处理失败: ' + jsonError.message);
            }
        } catch (fetchError) {
            console.error('请求或处理响应时出错:', fetchError);
            updateProgress(100, '导出失败: ' + fetchError.message, 'error');
                
            // 延迟一秒后关闭进度条，让用户看到错误状态
            setTimeout(() => {
                if (progressModal) {
                    progressModal.hide();
                }
            }, 1500);
            
            throw new Error('导出报告失败: ' + fetchError.message);
        }
        
        resetExportButton(exportType);
    } catch (error) {
        // 检查是否是用户取消导致的错误
        if (error.name === 'AbortError') {
            console.log('用户取消了导出请求');
            updateProgress(100, '导出已取消', 'warning');
            
            // 延迟关闭进度窗口
            setTimeout(() => {
                hideProgressModal();
                showExportCompleteModal('导出已取消', '您已取消导出操作', 'warning');
            }, 1000);
        } else {
            console.error('导出过程中发生错误:', error);
            
            // 隐藏进度模态框并清理遮罩
            hideProgressModal();
            
            // 使用错误图标显示导出完成模态框
            showExportCompleteModal(
                `${exportType === 'pdf' ? 'PDF' : 'Word'}导出失败`, 
                `导出过程中出错: ${error.message || '未知错误'}`, 
                'error'
            );
        }
        
        // 重置导出按钮
        resetExportButton(exportType);
        
        // 重置导出状态
        window.isExporting = false;
        currentExportRequestId = null;
        abortController = null;
    }
}

// 取消导出函数
function cancelExport(requestId) {
    if (!requestId || requestId !== currentExportRequestId) {
        console.warn('没有进行中的导出或请求ID不匹配');
        return;
    }
    
    console.log('正在取消导出请求:', requestId);
    
    // 更新UI显示状态
    updateProgress(0, '正在取消导出...', 'warning');
    
    // 取消进行中的fetch请求
    if (abortController) {
        abortController.abort();
    }
    
    // 向服务器发送取消请求
    fetch('/api/cancel-export', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requestId: requestId
        })
    }).then(response => response.json())
    .then(data => {
        console.log('取消导出响应:', data);
        if (data.status === 'success' || data.status === 'ok') {
            console.log('成功取消导出操作');
        } else {
            console.warn('取消导出返回未知状态:', data);
        }
    })
    .catch(error => {
        console.error('发送取消导出请求时出错:', error);
    })
    .finally(() => {
        // 无论成功与否，都重置状态
        currentExportRequestId = null;
        abortController = null;
        window.isExporting = false;
        
        // 延迟关闭进度窗口
        setTimeout(() => {
            hideProgressModal();
            showNotification('导出操作已取消', 'warning');
        }, 1000);
        
        // 重置导出按钮
        const exportType = document.getElementById('exportPdfBtn').disabled ? 'pdf' : 'word';
        resetExportButton(exportType);
    });
}

// 更新进度条和文本
function updateProgress(percent, message, type = 'normal') {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        
        // 根据类型设置进度条颜色
        progressBar.className = 'progress-bar';
        if (type === 'error') {
            progressBar.classList.add('bg-danger');
        } else if (percent === 100) {
            progressBar.classList.add('bg-success');
        } else {
            progressBar.classList.add('bg-primary', 'progress-bar-striped', 'progress-bar-animated');
        }
    }
    
    if (progressText) {
        progressText.innerHTML = `${message} <span class="badge bg-secondary">${percent}%</span>`;
        
        if (type === 'error') {
            progressText.classList.add('text-danger');
        } else {
            progressText.classList.remove('text-danger');
        }
    }
}

// 重置导出按钮
function resetExportButton(exportType = 'word') {
    const exportBtn = document.getElementById(exportType === 'pdf' ? 'exportPdfBtn' : 'exportBtn');
    if (exportBtn) {
        exportBtn.disabled = false;
        if (exportType === 'pdf') {
            exportBtn.innerHTML = '<i class="bx bxs-file-pdf"></i> 导出PDF';
        } else {
            exportBtn.innerHTML = '<i class="bx bxs-file-doc"></i> 导出Word';
        }
    }
    
    // 确保窗口状态正常
    setTimeout(clearAllModalBackdrops, 500);
    
    // 重置导出状态
    window.isExporting = false;
}

// 从自定义模板生成文档
async function generateFromTemplate(templateFile, student, comment, grade, subjects, settings) {
    try {
        // 显示处理状态
        console.log('开始处理模板文件:', templateFile.name, '大小:', templateFile.size, 'bytes');
        
        // 确保PizZip和Docxtemplater已加载
        const { PizZip, Docxtemplater } = await loadDocxTemplaterLibraries();
        console.log('模板库加载成功: PizZip =', typeof PizZip, ', Docxtemplater =', typeof Docxtemplater);
        
        // 读取模板文件
        const reader = new FileReader();
        const fileContent = await new Promise((resolve, reject) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(templateFile);
        });
        
        console.log('模板文件读取成功，大小:', fileContent.byteLength, '字节');
        
        // 准备数据
        const data = prepareTemplateData(student, comment, grade, subjects, settings);
        console.log('已准备模板数据:', Object.keys(data).length, '个字段');
        
        try {
            // 创建一个zip实例
        const zip = new PizZip(fileContent);
        
            // 创建docxtemplater实例，使用正确的构造函数形式
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true
            });
        
        // 设置数据
        doc.setData(data);
        
        // 渲染文档
        doc.render();
        
            // 生成输出文件
        const out = doc.getZip().generate({
            type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                compression: 'DEFLATE'
        });
        
            console.log('成功生成输出文档，大小:', out.size, 'bytes');
        return out;
        } catch (err) {
            console.error('渲染文档时出错:', err);
            
            // 尝试使用window.docxtemplater (CDN版本可能是这个名称)
            if (window.docxtemplater) {
                console.log('尝试使用window.docxtemplater作为构造函数');
                const zip = new PizZip(fileContent);
                const doc = new window.docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true
                });
                
                doc.setData(data);
                doc.render();
                
                const out = doc.getZip().generate({
                    type: 'blob',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    compression: 'DEFLATE'
                });
                
                console.log('使用window.docxtemplater成功生成输出文档，大小:', out.size, 'bytes');
                return out;
            }
            
            throw err;
        }
    } catch (error) {
        console.error('从模板生成文档时出错:', error);
        showNotification('生成报告时出错: ' + error.message, 'error');
        // 创建一个空的Word文档作为错误回退
        return new Blob(['错误: ' + error.message], {type: 'text/plain'});
    }
}

// 创建简单文档（不使用模板）
function createSimpleDocument(student, comment, grade, subjects, settings) {
    // 生成一个简单的docx内容
    const content = `
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p>
                    <w:r>
                        <w:t>学生成绩报告</w:t>
                    </w:r>
                </w:p>
                <w:p>
                    <w:r>
                        <w:t>姓名: ${student.name || ''}</w:t>
                    </w:r>
                </w:p>
                <w:p>
                    <w:r>
                        <w:t>学号: ${student.id || ''}</w:t>
                    </w:r>
                </w:p>
                <w:p>
                    <w:r>
                        <w:t>评语: ${comment ? comment.content || '' : ''}</w:t>
                    </w:r>
                </w:p>
            </w:body>
        </w:document>
    `;
    
    // 创建一个简单的文本文件
    return new Blob([content], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
}

// 创建错误文档
function createErrorDocument(student, error) {
    const errorContent = `
        学生成绩报告生成失败
        
        学生: ${student ? student.name || 'Unknown' : 'Unknown'}
        学号: ${student ? student.id || 'Unknown' : 'Unknown'}
        
        错误信息: ${error.message || '未知错误'}
        
        请联系系统管理员处理此问题。
    `;
    
    return new Blob([errorContent], { type: 'text/plain' });
}

// 加载Docxtemplater库
async function loadDocxTemplaterLibraries() {
    try {
        // 优先使用window.loadDocxLibraries函数（在export.html中定义）
        if (typeof window.loadDocxLibraries === 'function') {
            console.log('使用页面预定义的loadDocxLibraries函数');
            try {
                return await window.loadDocxLibraries();
            } catch (err) {
                console.warn('页面库加载失败，尝试自动加载:', err);
                // 继续使用下面的加载逻辑
            }
        }

        // 检查全局变量是否可用
        const pizzip = window.PizZip || (typeof PizZip !== 'undefined' ? PizZip : null);
        const docxLib = window.Docxtemplater || window.docxtemplater || 
                      (typeof Docxtemplater !== 'undefined' ? Docxtemplater : null) || 
                      (typeof docxtemplater !== 'undefined' ? docxtemplater : null);
        
        // 如果库已加载，直接使用
        if (pizzip && docxLib) {
            console.log('文档处理库已加载，直接使用');
            // 确保全局对象存在
            window.PizZip = pizzip;
            window.Docxtemplater = docxLib;
            return { PizZip: pizzip, Docxtemplater: docxLib };
        }
        
        // 如果库不可用，尝试加载本地文件
        console.warn('未检测到预加载的库，尝试加载本地库文件');
        
        // 加载PizZip
        if (!pizzip) {
            await new Promise((resolve, reject) => {
                console.log('正在加载本地PizZip库...');
                const script = document.createElement('script');
                script.src = '../libs/pizzip.min.js';
                script.onload = () => {
                    console.log('本地PizZip库加载成功');
                    // 全局对象可能是 PizZip 而不是 PizZip，确保正确
                    window.PizZip = typeof PizZip !== 'undefined' ? PizZip : null;
                    resolve();
                };
                script.onerror = () => {
                    console.error('本地PizZip库加载失败，尝试CDN');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.4/pizzip.min.js';
                    script.onload = () => {
                        console.log('CDN PizZip库加载成功');
                        window.PizZip = typeof PizZip !== 'undefined' ? PizZip : null;
                        resolve();
                    };
                    script.onerror = (e) => {
                        console.error('所有PizZip库源加载失败', e);
                    reject(new Error('无法加载PizZip库'));
                };
                };
                document.head.appendChild(script);
            });
        }
        
        // 加载Docxtemplater
        if (!docxLib) {
            await new Promise((resolve, reject) => {
                console.log('正在加载本地Docxtemplater库...');
                const script = document.createElement('script');
                script.src = '../libs/docxtemplater.js';
                script.onload = () => {
                    console.log('本地Docxtemplater库加载成功');
                    if (typeof window.docxtemplater !== 'undefined') {
                        window.Docxtemplater = window.docxtemplater;
                    } else if (typeof docxtemplater !== 'undefined') {
                        window.Docxtemplater = docxtemplater;
                    } else if (typeof Docxtemplater !== 'undefined') {
                        window.Docxtemplater = Docxtemplater;
                    }
                    resolve();
                };
                script.onerror = () => {
                    console.error('本地Docxtemplater库加载失败，尝试CDN');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.37.11/docxtemplater.js';
                    script.onload = () => {
                        console.log('CDN Docxtemplater库加载成功');
                        if (typeof window.docxtemplater !== 'undefined') {
                            window.Docxtemplater = window.docxtemplater;
                        } else if (typeof docxtemplater !== 'undefined') {
                            window.Docxtemplater = docxtemplater;
                        } else if (typeof Docxtemplater !== 'undefined') {
                            window.Docxtemplater = Docxtemplater;
                        }
                        resolve();
                    };
                    script.onerror = (e) => {
                        console.error('所有Docxtemplater库源加载失败', e);
                    reject(new Error('无法加载Docxtemplater库'));
                };
                };
                document.head.appendChild(script);
            });
        }
        
        // 最终检查
        const finalPizzip = window.PizZip || (typeof PizZip !== 'undefined' ? PizZip : null);
        const finalDocxLib = window.Docxtemplater || window.docxtemplater || 
                           (typeof Docxtemplater !== 'undefined' ? Docxtemplater : null) || 
                           (typeof docxtemplater !== 'undefined' ? docxtemplater : null);
        
        if (!finalPizzip) {
            throw new Error('加载PizZip库失败');
        }
        
        if (!finalDocxLib) {
            throw new Error('加载Docxtemplater库失败');
        }
        
        console.log('文档处理库加载完成');
        return { PizZip: finalPizzip, Docxtemplater: finalDocxLib };
    } catch (error) {
        console.error('库加载过程中出错:', error);
        // 确保在页面上显示友好的错误消息
        if (typeof showNotification === 'function') {
            showNotification('无法加载文档处理库: ' + error.message, 'error');
        } else {
            alert('导出功能暂时不可用: 无法加载文档处理库');
        }
        throw error;
    }
}

// 修改prepareTemplateData函数，确保不再处理这些字段
function prepareTemplateData(student, comment, grade, subjects, settings) {
    // 获取学期文本
    const semesterText = settings.semester === '1' ? '第一学期' : '第二学期';
    
    // 处理开学时间，只显示月日
    let startDateText = '';
    if (settings.startDate) {
        try {
            const startDate = new Date(settings.startDate);
            if (!isNaN(startDate.getTime())) {
                // 月份需要+1，因为getMonth()返回0-11
                const month = startDate.getMonth() + 1;
                const day = startDate.getDate();
                startDateText = `${month}月${day}日`;
            }
        } catch (e) {
            console.error('处理开学时间出错:', e);
            startDateText = settings.startDate; // 如果出错，使用原始值
        }
    }
    
    // 准备基本数据 - 只包含students表中实际存在的字段
    const data = {
        "{{姓名}}": student.name || '',
        "{{性别}}": student.gender || '',
        "{{班级}}": student.class || settings.className || '',
        "{{身高}}": student.height || '',
        "{{体重}}": student.weight || '',
        "{{肺活量}}": student.vitalCapacity || '',
        "{{视力左}}": student.visionLeft || '',
        "{{视力右}}": student.visionRight || '',
        "{{体测情况}}": student.physicalTestStatus || '',
        "{{胸围}}": student.chestCircumference || '',
        "{{龋齿}}": student.dentalCaries || '',
        
        // 评语相关
        "{{评语}}": comment && comment.content ? comment.content : '',
        "{{品质}}": comment && comment.quality ? comment.quality : '',
        "{{学习}}": comment && comment.learning ? comment.learning : '',
        "{{健康}}": comment && comment.health ? comment.health : '',
        "{{审美}}": comment && comment.aesthetic ? comment.aesthetic : '',
        "{{实践}}": comment && comment.practice ? comment.practice : '',
        "{{生活}}": comment && comment.life ? comment.life : '',
        
        // 学期信息
        "{{学年}}": settings.schoolYear || '',
        "{{学期}}": semesterText || '',
        "{{开学时间}}": startDateText,
        "{{班主任}}": settings.teacherName || '',
        "{{学号}}": student.id || ''
    };
    
    // 添加成绩数据
    if (grade) {
        subjects.forEach(subject => {
            const zhSubject = SUBJECT_MAPPING[subject] || subject;
            data[`{{${zhSubject}}}`] = grade[subject] || '';
        });
    }
    
    return data;
}

// 使用docx.js库生成默认文档
async function generateDefaultDocument(student, comment, grade, subjects, settings) {
    // 获取docx组件
    const docx = await window.docxModule.getDocxComponents();
            
            // 创建文档
            const doc = new docx.Document({
                sections: [{
                    properties: {},
                    children: [
                        new docx.Paragraph({
                            text: `${settings.schoolName}学生综合素质发展报告单`,
                            heading: docx.HeadingLevel.HEADING_1,
                            alignment: docx.AlignmentType.CENTER,
                        }),
                        new docx.Paragraph({
                            text: `${settings.schoolYear}学年 第${settings.semester}学期`,
                            alignment: docx.AlignmentType.CENTER,
                        }),
                        new docx.Paragraph({
                            text: "",
                        }),
                        new docx.Table({
                            width: {
                                size: 100,
                                type: docx.WidthType.PERCENTAGE,
                            },
                            rows: [
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("班级")],
                                            width: {
                                                size: 15,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(settings.className)],
                                            width: {
                                                size: 35,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("姓名")],
                                            width: {
                                                size: 15,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.name)],
                                            width: {
                                                size: 35,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                    ],
                                }),
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("学号")],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.id)],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("日期")],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(settings.exportDate)],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        new docx.Paragraph({
                            text: "",
                        }),
                    ]
                }]
            });
            
            // 添加基本信息部分
            if (settings.includeBasicInfo) {
                doc.addSection({
                    children: [
                        new docx.Paragraph({
                            text: "基本信息",
                            heading: docx.HeadingLevel.HEADING_2,
                        }),
                        new docx.Table({
                            width: {
                                size: 100,
                                type: docx.WidthType.PERCENTAGE,
                            },
                            rows: [
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("性别")],
                                            width: {
                                                size: 15,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.gender)],
                                            width: {
                                                size: 35,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("出生日期")],
                                            width: {
                                                size: 15,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.birthdate)],
                                            width: {
                                                size: 35,
                                                type: docx.WidthType.PERCENTAGE,
                                            },
                                        }),
                                    ],
                                }),
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("家长电话")],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.parentPhone)],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("家庭住址")],
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(student.address)],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        new docx.Paragraph({
                            text: "",
                        }),
                    ]
                });
            }
            
    // 添加评语部分
    if (settings.includeComment && comment) {
        doc.addSection({
            children: [
                new docx.Paragraph({
                    text: "评语",
                    heading: docx.HeadingLevel.HEADING_2,
                }),
                new docx.Paragraph({
                    text: comment.content || "暂无评语",
                }),
                new docx.Paragraph({
                    text: "",
                }),
            ]
        });
    }

    // 添加成绩部分
    if (settings.includeGrades && grade && subjects && subjects.length > 0) {
        const tableRows = [
            new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [new docx.Paragraph("科目")],
                        width: {
                            size: 25,
                            type: docx.WidthType.PERCENTAGE,
                        },
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("分数")],
                        width: {
                            size: 25,
                            type: docx.WidthType.PERCENTAGE,
                        },
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("科目")],
                        width: {
                            size: 25,
                            type: docx.WidthType.PERCENTAGE,
                        },
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("分数")],
                        width: {
                            size: 25,
                            type: docx.WidthType.PERCENTAGE,
                        },
                    }),
                ],
            })
        ];

        // 将科目分成两两一组，每行显示两个科目的成绩
        for (let i = 0; i < subjects.length; i += 2) {
            const rowCells = [];
            
            // 添加第一个科目
            const subject1 = subjects[i];
            rowCells.push(
                new docx.TableCell({
                    children: [new docx.Paragraph(subject1.name)],
                }),
                new docx.TableCell({
                    children: [new docx.Paragraph(grade[subject1.id]?.score?.toString() || "-")],
                })
            );
            
            // 如果有第二个科目，也添加
            if (i + 1 < subjects.length) {
                const subject2 = subjects[i + 1];
                rowCells.push(
                    new docx.TableCell({
                        children: [new docx.Paragraph(subject2.name)],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph(grade[subject2.id]?.score?.toString() || "-")],
                    })
                );
            } else {
                // 如果没有第二个科目，添加空单元格
                rowCells.push(
                    new docx.TableCell({
                        children: [new docx.Paragraph("")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("")],
                    })
                );
            }
            
            tableRows.push(new docx.TableRow({ children: rowCells }));
        }
        
        // 添加总分、平均分、排名行
        tableRows.push(
            new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [new docx.Paragraph("总分")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph(grade.total?.toString() || "-")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("平均分")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph(grade.average?.toString() || "-")],
                    }),
                ],
            }),
            new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [new docx.Paragraph("班级排名")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph(grade.rank?.toString() || "-")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("")],
                    }),
                    new docx.TableCell({
                        children: [new docx.Paragraph("")],
                    }),
                ],
            })
        );

        doc.addSection({
            children: [
                new docx.Paragraph({
                    text: "成绩",
                    heading: docx.HeadingLevel.HEADING_2,
                }),
                new docx.Table({
                    width: {
                        size: 100,
                        type: docx.WidthType.PERCENTAGE,
                    },
                    rows: tableRows
                }),
                new docx.Paragraph({
                    text: "",
                }),
            ]
        });
    }

    // 添加教师信息部分
    doc.addSection({
        children: [
            new docx.Paragraph({
                text: "",
            }),
            new docx.Paragraph({
                text: "",
            }),
            new docx.Paragraph({
                text: `班主任：${settings.teacherName}`,
                alignment: docx.AlignmentType.RIGHT,
            }),
            new docx.Paragraph({
                text: formatDate(new Date()),
                alignment: docx.AlignmentType.RIGHT,
            }),
        ]
    });
    
    // 导出文档
    return await docx.Packer.toBlob(doc);
}

// 显示通知提示
function showNotification(message, type = 'success') {
    const toast = document.getElementById('notificationToast');
    if (!toast) return;
    
    const toastBody = toast.querySelector('.toast-body');
    toastBody.textContent = message;
    
    // 设置通知类型
    toast.classList.remove('bg-success', 'bg-danger', 'bg-info', 'text-white');
    const icon = toast.querySelector('.toast-header i');
    icon.classList.remove('bx-info-circle', 'bx-check-circle', 'bx-error-circle');
    
    switch(type) {
        case 'error':
            toast.classList.add('bg-danger', 'text-white');
            icon.classList.add('bx-error-circle');
            break;
        case 'info':
            toast.classList.add('bg-info', 'text-white');
            icon.classList.add('bx-info-circle');
            break;
        default:
            toast.classList.add('bg-success', 'text-white');
            icon.classList.add('bx-check-circle');
    }
    
    // 显示通知
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// 格式化日期
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 保存导出设置
 */
function saveExportSettings() {
    const settings = {
        schoolYear: $('#export-school-year').val(),
        semester: $('#export-semester').val(),
        semesterText: $('#export-semester-text').val(),
        startDate: $('#export-start-date').val(),
        includeBasicInfo: $('#export-include-basic-info').prop('checked'),
        includeGrades: $('#export-include-grades').prop('checked'),
        includeComments: $('#export-include-comments').prop('checked'),
        fileNameFormat: $('input[name="export-file-name-format"]:checked').val(),
        schoolName: $('#export-school-name').val(),
        className: $('#export-class-name').val(),
        teacherName: $('#export-teacher-name').val(),
        exportDate: $('#export-date').val()
    };

    localStorage.setItem('exportSettings', JSON.stringify(settings));
    return settings;
}

/**
 * 获取导出设置
 */
function getExportSettings() {
    const settingsJson = localStorage.getItem('exportSettings');
    let settings = null;

    if (settingsJson) {
        try {
            settings = JSON.parse(settingsJson);
        } catch (e) {
            console.error('解析导出设置时出错', e);
        }
    }

    // 合并默认设置
    return Object.assign({}, DEFAULT_EXPORT_SETTINGS, settings || {});
}

// 绑定导出设置字段的变更事件
function bindExportSettingsEvents() {
    // 开学时间
    const startDateInput = document.getElementById('startDate');
    if (startDateInput) {
        startDateInput.addEventListener('change', function() {
            updateExportSettings();
            updatePreview();
        });
    }
    
    // 包含内容复选框
    const includeInputs = document.querySelectorAll('#includeBasicInfo, #includeGrades, #includeComments');
    includeInputs.forEach(input => {
        input.addEventListener('change', function() {
            updateExportSettings();
            updatePreview();
        });
    });
    
    // 文件命名格式
    const fileNameFormatInput = document.getElementById('fileNameFormat');
    if (fileNameFormatInput) {
        fileNameFormatInput.addEventListener('change', function() {
            updateExportSettings();
        });
    }
    
    // 班主任姓名
    const teacherNameInput = document.getElementById('teacherName');
    if (teacherNameInput) {
        teacherNameInput.addEventListener('input', function() {
            updateExportSettings();
            updatePreview();
        });
    }
}

// 初始化模板选择
async function initTemplateSelection() {
    try {
        console.log('正在初始化模板选择');
        
        // 设置默认使用泉州东海湾实验学校综合素质发展报告单模板
        const settings = dataService.getExportSettings();
        settings.templateId = '泉州东海湾实验学校综合素质发展报告单';
        settings.templateName = '泉州东海湾实验学校综合素质发展报告单';
        settings.useDefaultTemplate = false;
        dataService.saveExportSettings(settings);
        
        // 显示模板信息
        const templateNameElement = document.getElementById('templateName');
        if (templateNameElement) {
            templateNameElement.textContent = '泉州东海湾实验学校综合素质发展报告单';
        }
        
        // 显示已选模板信息
        const uploadedTemplate = document.getElementById('uploadedTemplate');
        if (uploadedTemplate) {
            uploadedTemplate.classList.remove('d-none');
        }
        
        // 显示默认模板信息
        const defaultTemplate = document.getElementById('defaultTemplate');
        if (defaultTemplate) {
            defaultTemplate.classList.remove('d-none');
            defaultTemplate.querySelector('strong').textContent = '泉州东海湾实验学校综合素质发展报告单';
        }
    } catch (error) {
        console.error('初始化模板选择失败:', error);
        showNotification('初始化模板选择失败', 'warning');
    }
}

// 绑定所有设置相关的事件处理程序
function bindSettingsEvents() {
    console.log('绑定设置事件...');
    
    // 绑定全选学生复选框事件
    const selectAllStudents = document.getElementById('selectAllStudents');
    if (selectAllStudents) {
        selectAllStudents.addEventListener('change', function() {
            toggleSelectAllStudents(this.checked);
        });
    }
    
    // 绑定排序选项事件
    const sortOptions = document.querySelectorAll('input[name="sortOption"]');
    sortOptions.forEach(option => {
        option.addEventListener('change', function() {
            sortStudentList(this.id === 'sortByName' ? 'name' : 'id');
        });
    });
    
    // 绑定设置变更事件
    bindExportSettingsEvents();
    
    // 绑定导出按钮事件
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(event) {
            event.preventDefault();
            exportReports('word');
        });
    }
    
    // 绑定预览按钮事件
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            showPreview();
        });
    }
    
    // 绑定预览中的导出按钮
    const exportFromPreviewBtn = document.getElementById('exportFromPreviewBtn');
    if (exportFromPreviewBtn) {
        exportFromPreviewBtn.addEventListener('click', function() {
            // 关闭预览模态框
            const previewModal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
            if (previewModal) {
                previewModal.hide();
            }
            
            // 触发导出
            exportReports('word');
        });
    }
    
    console.log('设置事件绑定完成');
}

// 初始化导出功能
function initExportFunctions() {
    // Word导出按钮事件监听
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportReports('word');
        });
    }
    
    // PDF导出按钮事件监听
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function() {
            // 显示确认对话框
            const pdfConfirmModal = new bootstrap.Modal(document.getElementById('pdfConfirmModal'));
            pdfConfirmModal.show();
        });
    }
    
    // PDF确认导出按钮事件监听
    const confirmPdfExportBtn = document.getElementById('confirmPdfExportBtn');
    if (confirmPdfExportBtn) {
        confirmPdfExportBtn.addEventListener('click', function() {
            // 隐藏确认对话框
            const pdfConfirmModal = bootstrap.Modal.getInstance(document.getElementById('pdfConfirmModal'));
            if (pdfConfirmModal) {
                pdfConfirmModal.hide();
            }
            
            // 执行PDF导出
            exportReports('pdf');
        });
    }
}

// 隐藏进度模态框
function hideProgressModal() {
    try {
        const progressModal = bootstrap.Modal.getInstance(document.getElementById('progressModal'));
        if (progressModal) {
            progressModal.hide();
        }
        
        // 重置进度条
        document.getElementById('exportProgressBar').style.width = '0%';
        document.getElementById('exportProgressBar').setAttribute('aria-valuenow', '0');
        document.getElementById('progressText').innerText = '';
        
        // 延迟清理模态框背景
        setTimeout(clearAllModalBackdrops, 300);
    } catch (e) {
        console.error('隐藏进度模态框失败:', e);
        clearAllModalBackdrops();
    }
}

// 显示导出完成模态框
function showExportCompleteModal(title, message, type = 'success') {
    try {
        // 获取并处理之前的模态实例
        const oldModal = bootstrap.Modal.getInstance(document.getElementById('exportCompleteModal'));
        if (oldModal) {
            oldModal.dispose();
        }
        
        // 设置标题和消息
        document.getElementById('exportCompleteModalLabel').innerText = title;
        document.getElementById('exportCompleteModal').querySelector('.alert div').innerText = message;
        
        // 设置模态框的颜色主题
        const modalContent = document.querySelector('.export-complete-modal');
        const modalHeader = document.getElementById('exportCompleteModal').querySelector('.modal-header');
        const modalButton = document.getElementById('closeExportCompleteBtn');
        const modalAlert = document.getElementById('exportCompleteModal').querySelector('.alert');
        const modalIcon = document.getElementById('exportCompleteModal').querySelector('.modal-body i.bx');
        
        // 根据类型设置不同的颜色主题
        if (type === 'success') {
            modalContent.style.animation = 'success-glow 2s infinite alternate';
            modalContent.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.7)';
            modalHeader.className = 'modal-header bg-success text-white';
            modalButton.className = 'btn btn-success';
            modalAlert.className = 'alert alert-success';
            modalIcon.className = 'bx bx-check-circle text-success';
        } else if (type === 'warning') {
            modalContent.style.animation = 'warning-glow 2s infinite alternate';
            modalContent.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.7)';
            modalHeader.className = 'modal-header bg-warning text-dark';
            modalButton.className = 'btn btn-warning';
            modalAlert.className = 'alert alert-warning';
            modalIcon.className = 'bx bx-error text-warning';
        } else if (type === 'error') {
            modalContent.style.animation = 'error-glow 2s infinite alternate';
            modalContent.style.boxShadow = '0 0 20px rgba(220, 53, 69, 0.7)';
            modalHeader.className = 'modal-header bg-danger text-white';
            modalButton.className = 'btn btn-danger';
            modalAlert.className = 'alert alert-danger';
            modalIcon.className = 'bx bx-x-circle text-danger';
        }
        
        // 根据类型设置图标
        const titleElement = document.getElementById('exportCompleteModalLabel');
        titleElement.innerHTML = '';
        
        let icon = document.createElement('i');
        icon.classList.add('bx', 'me-2');
        
        if (type === 'success') {
            icon.classList.add('bx-check-circle');
        } else if (type === 'warning') {
            icon.classList.add('bx-error');
        } else if (type === 'error') {
            icon.classList.add('bx-x-circle');
        }
        
        titleElement.appendChild(icon);
        titleElement.appendChild(document.createTextNode(title));
        
        // 创建并显示新模态框
        const newModal = new bootstrap.Modal(document.getElementById('exportCompleteModal'));
        newModal.show();
        
        // 监听模态框隐藏事件
        document.getElementById('exportCompleteModal').addEventListener('hidden.bs.modal', function handler() {
            setTimeout(clearAllModalBackdrops, 300);
            // 移除事件监听器，避免重复
            document.getElementById('exportCompleteModal').removeEventListener('hidden.bs.modal', handler);
        });
    } catch (e) {
        console.error('显示导出完成模态框失败:', e);
        alert(title + ': ' + message);
    }
}

// 等待DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 处理确认PDF导出按钮点击事件
    document.getElementById('confirmPdfExportBtn').addEventListener('click', function() {
        try {
            // 隐藏确认模态框
            const pdfConfirmModal = bootstrap.Modal.getInstance(document.getElementById('pdfConfirmModal'));
            if (pdfConfirmModal) {
                pdfConfirmModal.hide();
            }
            
            // 延迟一下确保模态框关闭后再清理背景
            setTimeout(function() {
                // 清理所有模态框背景
                clearAllModalBackdrops();
                // 调用PDF导出函数
                exportReports('pdf');
            }, 300);
        } catch (e) {
            console.error('关闭PDF确认模态框失败:', e);
            // 尝试直接清理背景并调用导出
            clearAllModalBackdrops();
            exportReports('pdf');
        }
    });
    
    // 给所有模态框的关闭按钮添加事件处理
    document.querySelectorAll('.modal .btn-close, .modal .btn[data-bs-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', function() {
            setTimeout(clearAllModalBackdrops, 300);
        });
    });
    
    // 特别处理导出完成模态框的关闭按钮
    document.getElementById('closeExportCompleteBtn').addEventListener('click', function() {
        try {
            const exportCompleteModal = bootstrap.Modal.getInstance(document.getElementById('exportCompleteModal'));
            if (exportCompleteModal) {
                exportCompleteModal.hide();
            }
            
            setTimeout(clearAllModalBackdrops, 300);
        } catch (e) {
            console.error('关闭导出完成模态框失败:', e);
            clearAllModalBackdrops();
        }
    });
    
    // 监听所有模态框的hidden事件
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('hidden.bs.modal', function() {
            setTimeout(clearAllModalBackdrops, 300);
        });
    });
});

// 清理所有模态框背景
function clearAllModalBackdrops() {
    // 移除所有模态框背景
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
    });
    
    // 重置body样式
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    console.log('已清理所有模态框背景');
}
