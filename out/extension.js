"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const child_process_1 = require("child_process");
const status_1 = require("./status");
const { src, dest } = require("gulp");
const uglify = require("gulp-uglify");
const rename = require("gulp-rename");
const babel = require("gulp-babel");
const babelEnv = require("@babel/preset-env");
const less = require("gulp-less");
const cssmin = require("gulp-minify-css");
const ts = require("gulp-typescript");
const jade = require("gulp-jade");
const pug = require("pug");
const open = require("open");
const through = require("through2");
const sass = require("sass");
const { formatters, formatActiveDocument } = require("./beautify");
const successMessage = "✔ Compilation Successed!";
const errorMessage = "❌ Compilation Failed!";
const minimatch = require('minimatch');
const readFileContext = (path) => {
    return fs.readFileSync(path).toString();
};
const fileType = (filename) => {
    const index1 = filename.lastIndexOf(".");
    const index2 = filename.length;
    const type = filename.substring(index1, index2);
    return type;
};
const command = (cmd) => {
    return new Promise((resolve, reject) => {
        child_process_1.exec(cmd, (err, stdout, stderr) => {
            resolve(stdout);
        });
    });
};
const transformPort = (data) => {
    let port = "";
    data.split(/[\n|\r]/).forEach((item) => {
        if (item.indexOf("LISTEN") !== -1 && !port) {
            let reg = item.split(/\s+/);
            if (/\d+/.test(reg[1])) {
                port = reg[1];
            }
        }
    });
    return port;
};
const empty = function (code) {
    let stream = through.obj((file, encoding, callback) => {
        if (!file.isBuffer()) {
            return callback();
        }
        file.contents = Buffer.from(code || "");
        stream.push(file);
        callback();
    });
    return stream;
};
const complieFile = (uri) => {
    readFileName({ fileName: uri });
};
const complieDir = (uri) => {
    const files = fs.readdirSync(uri);
    files.forEach((filename) => {
        const fileUrl = path.join(uri, filename);
        const fileStats = fs.statSync(fileUrl);
        if (fileStats.isDirectory()) {
            complieDir(fileUrl);
        }
        else {
            complieFile(fileUrl);
        }
    });
};
// 获取工作区位置
const getWorkspaceRoot = (doc) => {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0)
        return;
    if (!doc || doc.isUntitled)
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder)
        return;
    return folder.uri.fsPath;
};
const readFileName = ({ fileName }) => __awaiter(void 0, void 0, void 0, function* () {
    let workspaceRootPath = vscode.workspace.rootPath;
    let fileSuffix = fileType(fileName);
    let config = vscode.workspace.getConfiguration("compile-hero");
    let outputDirectoryPath = {
        ".js": config.get("javascript-output-directory") || "",
        ".scss": config.get("scss-output-directory") || "",
        ".sass": config.get("sass-output-directory") || "",
        ".less": config.get("less-output-directory") || "",
        ".jade": config.get("jade-output-directory") || "",
        ".ts": config.get("typescript-output-directory") || "",
        ".tsx": config.get("typescriptx-output-directory") || "",
        ".pug": config.get("pug-output-directory") || "",
    };
    let compileStatus = {
        ".js": config.get("javascript-output-toggle"),
        ".scss": config.get("scss-output-toggle"),
        ".sass": config.get("sass-output-toggle"),
        ".less": config.get("less-output-toggle"),
        ".jade": config.get("jade-output-toggle"),
        ".ts": config.get("typescript-output-toggle"),
        ".tsx": config.get("typescriptx-output-toggle"),
        ".pug": config.get("pug-output-toggle"),
    };
    let ignore = config.get("ignore") || [];
    if (workspaceRootPath && fileName.startsWith(workspaceRootPath)) {
        let relativePath = path.relative(workspaceRootPath, fileName);
        if (!Array.isArray(ignore)) {
            ignore = [ignore];
        }
        ;
        if (ignore.some(glob => minimatch(relativePath, glob)))
            return;
    }
    ;
    let notificationStatus = config.get("notification-toggle");
    let compileOptions = {
        generateMinifiedHtml: config.get("generate-minified-html"),
        generateMinifiedCss: config.get("generate-minified-css"),
        generateMinifiedJs: config.get("generate-minified-javascript"),
    };
    if (!compileStatus[fileSuffix])
        return;
    let outputPath = path.resolve(fileName, "../", outputDirectoryPath[fileSuffix]);
    switch (fileSuffix) {
        case ".scss":
        case ".sass":
            try {
                const { css } = sass.renderSync({ file: fileName });
                const text = css.toString();
                src(fileName)
                    .pipe(empty(text))
                    .pipe(rename({
                    extname: ".css",
                }))
                    .pipe(dest(outputPath))
                    .pipe(dest(outputPath));
                if (compileOptions.generateMinifiedCss) {
                    src(fileName)
                        .pipe(empty(text))
                        .pipe(rename({
                        extname: ".css",
                    }))
                        .pipe(dest(outputPath))
                        .pipe(cssmin({ compatibility: "ie7" }))
                        .pipe(rename({
                        extname: ".css",
                        suffix: ".min",
                    }))
                        .pipe(dest(outputPath));
                }
                vscode.window.setStatusBarMessage(successMessage);
            }
            catch (error) {
                notificationStatus && vscode.window.showErrorMessage(error.message);
                vscode.window.setStatusBarMessage(errorMessage);
            }
            break;
        case ".js":
            if (/.dev.js|.prod.js$/g.test(fileName)) {
                vscode.window.setStatusBarMessage(`The prod or dev file has been processed and will not be compiled`);
                break;
            }
            src(fileName)
                .pipe(babel({
                presets: [babelEnv],
            }).on("error", (error) => {
                notificationStatus && vscode.window.showErrorMessage(error.message);
                vscode.window.setStatusBarMessage(errorMessage);
            }))
                .pipe(rename({ suffix: ".dev" }))
                .pipe(dest(outputPath));
            if (compileOptions.generateMinifiedJs) {
                src(fileName)
                    .pipe(babel({
                    presets: [babelEnv],
                }).on("error", (error) => {
                    notificationStatus && vscode.window.showErrorMessage(error.message);
                    vscode.window.setStatusBarMessage(errorMessage);
                }))
                    .pipe(uglify())
                    .pipe(rename({ suffix: ".prod" }))
                    .pipe(dest(outputPath));
            }
            vscode.window.setStatusBarMessage(successMessage);
            break;
        case ".less":
            src(fileName)
                .pipe(less().on("error", (error) => {
                notificationStatus && vscode.window.showErrorMessage(error.message);
                vscode.window.setStatusBarMessage(errorMessage);
            }))
                .pipe(dest(outputPath))
                .pipe(dest(outputPath))
                .on("end", () => {
                vscode.window.setStatusBarMessage(successMessage);
            });
            if (compileOptions.generateMinifiedCss) {
                src(fileName)
                    .pipe(less().on("error", (error) => {
                    notificationStatus && vscode.window.showErrorMessage(error.message);
                    vscode.window.setStatusBarMessage(errorMessage);
                }))
                    .pipe(dest(outputPath))
                    .pipe(cssmin({ compatibility: "ie7" }))
                    .pipe(rename({ suffix: ".min" }))
                    .pipe(dest(outputPath))
                    .on("end", () => {
                    vscode.window.setStatusBarMessage(successMessage);
                });
            }
            break;
        case ".ts":
            const tsConfigPath = path.join(fileName, '../tsconfig.json');
            const isExistsTsconfigPath = fs.existsSync(tsConfigPath);
            src(fileName)
                .pipe((() => {
                if (isExistsTsconfigPath) {
                    const tsConfig = ts.createProject(tsConfigPath);
                    return ts().pipe(tsConfig()).on("error", (error) => {
                        false && vscode.window.showErrorMessage(error.message);
                        vscode.window.setStatusBarMessage(errorMessage);
                    });
                }
                else {
                    return ts().on("error", (error) => {
                        false && vscode.window.showErrorMessage(error.message);
                        vscode.window.setStatusBarMessage(errorMessage);
                    });
                }
            })())
                .pipe(dest(outputPath));
            if (compileOptions.generateMinifiedJs) {
                src(fileName)
                    .pipe((() => {
                    if (isExistsTsconfigPath) {
                        const tsConfig = ts.createProject(tsConfigPath);
                        return ts().pipe(tsConfig()).on("error", (error) => {
                            false && vscode.window.showErrorMessage(error.message);
                            vscode.window.setStatusBarMessage(errorMessage);
                        });
                    }
                    else {
                        return ts().on("error", (error) => {
                            false && vscode.window.showErrorMessage(error.message);
                            vscode.window.setStatusBarMessage(errorMessage);
                        });
                    }
                })())
                    .pipe(uglify().on("error", (error) => {
                    false && vscode.window.showErrorMessage(error.message);
                    vscode.window.setStatusBarMessage(errorMessage);
                }))
                    .pipe(dest(outputPath));
            }
            vscode.window.setStatusBarMessage(successMessage);
            break;
        case ".tsx":
            const tsxConfigPath = path.join(fileName, '../tsconfig.json');
            const isExistsTsxconfigPath = fs.existsSync(tsxConfigPath);
            src(fileName)
                .pipe((() => {
                if (isExistsTsxconfigPath) {
                    const tsxConfig = ts.createProject(tsxConfigPath);
                    return ts({
                        jsx: "react",
                    }).pipe(tsxConfig()).on("error", (error) => {
                        false && vscode.window.showErrorMessage(error.message);
                        vscode.window.setStatusBarMessage(errorMessage);
                    });
                }
                else {
                    return ts({
                        jsx: "react",
                    }).on("error", (error) => {
                        false && vscode.window.showErrorMessage(error.message);
                        vscode.window.setStatusBarMessage(errorMessage);
                    });
                }
            })())
                .pipe(dest(outputPath));
            if (compileOptions.generateMinifiedJs) {
                src(fileName)
                    .pipe((() => {
                    if (isExistsTsxconfigPath) {
                        const tsxConfig = ts.createProject(tsxConfigPath);
                        return ts({
                            jsx: "react",
                        }).pipe(tsxConfig()).on("error", (error) => {
                            false && vscode.window.showErrorMessage(error.message);
                            vscode.window.setStatusBarMessage(errorMessage);
                        });
                    }
                    else {
                        return ts({
                            jsx: "react",
                        }).on("error", (error) => {
                            false && vscode.window.showErrorMessage(error.message);
                            vscode.window.setStatusBarMessage(errorMessage);
                        });
                    }
                })())
                    .pipe(uglify())
                    .pipe(dest(outputPath));
            }
            vscode.window.setStatusBarMessage(successMessage);
            break;
        case ".jade":
            src(fileName)
                .pipe(jade({
                pretty: true,
            }).on("error", (error) => {
                notificationStatus && vscode.window.showErrorMessage(error.message);
                vscode.window.setStatusBarMessage(errorMessage);
            }))
                .pipe(dest(outputPath));
            if (compileOptions.generateMinifiedHtml) {
                src(fileName)
                    .pipe(jade().on("error", (error) => {
                    notificationStatus && vscode.window.showErrorMessage(error.message);
                    vscode.window.setStatusBarMessage(errorMessage);
                }))
                    .pipe(rename({ suffix: ".min" }))
                    .pipe(dest(outputPath));
            }
            vscode.window.setStatusBarMessage(successMessage);
            break;
        case ".pug":
            let html = "";
            try {
                html = pug.renderFile(fileName, {
                    pretty: true,
                });
            }
            catch (error) {
                notificationStatus && vscode.window.showErrorMessage(error.message);
                vscode.window.setStatusBarMessage(errorMessage);
            }
            if (compileOptions.generateMinifiedHtml) {
                src(fileName)
                    .pipe(empty(html))
                    .pipe(rename({
                    extname: ".html",
                }))
                    .pipe(dest(outputPath))
                    .pipe(empty(pug.renderFile(fileName)))
                    .pipe(rename({
                    suffix: ".min",
                    extname: ".html",
                }))
                    .pipe(dest(outputPath));
            }
            vscode.window.setStatusBarMessage(successMessage);
            break;
        default:
            console.log("Not Found!");
            break;
    }
});
function activate(context) {
    console.log('Congratulations, compile hero is now active!');
    let openInBrowser = vscode.commands.registerCommand("compile-hero.openInBrowser", (path) => {
        let uri = path.fsPath;
        let platform = process.platform;
        open(uri, {
            app: [
                platform === "win32"
                    ? "chrome"
                    : platform === "darwin"
                        ? "google chrome"
                        : "google-chrome",
            ],
        }).catch((err) => {
            open(uri);
        });
    });
    let closePort = vscode.commands.registerCommand("compile-hero.closePort", () => __awaiter(this, void 0, void 0, function* () {
        let inputPort = yield vscode.window.showInputBox({
            placeHolder: "Enter the port you need to close?",
        });
        let info = yield command(`lsof -i :${inputPort}`);
        let port = transformPort(info);
        if (port) {
            yield command(`kill -9 ${port}`);
            vscode.window.setStatusBarMessage("Port closed successfully!");
        }
    }));
    let compileFile = vscode.commands.registerCommand("compile-hero.compileFile", (path) => {
        let uri = path.fsPath;
        try {
            if (fs.readdirSync(uri).length > 0) {
                complieDir(uri);
            }
            else {
                complieFile(uri);
            }
        }
        catch (error) {
            complieFile(uri);
        }
    });
    let compileHeroOn = vscode.commands.registerCommand("compile-hero.compileHeroOn", () => {
        let config = vscode.workspace.getConfiguration("compile-hero");
        config.update("disable-compile-files-on-did-save-code", true);
        status_1.StatusBarUi.notWatching();
    });
    let compileHeroOff = vscode.commands.registerCommand("compile-hero.compileHeroOff", () => {
        let config = vscode.workspace.getConfiguration("compile-hero");
        config.update("disable-compile-files-on-did-save-code", false);
        status_1.StatusBarUi.watching();
    });
    formatters.configure();
    let beautify = vscode.commands.registerCommand('compile-hero.beautify', formatActiveDocument.bind(0, true));
    let beautifyFile = vscode.commands.registerCommand('compile-hero.beautifyFile', formatActiveDocument.bind(0, false));
    let formattersConfigure = vscode.workspace.onDidChangeConfiguration(formatters.configure.bind(formatters));
    let formattersOnFileOpen = vscode.workspace.onDidOpenTextDocument(formatters.onFileOpen.bind(formatters));
    context.subscriptions.push(openInBrowser);
    context.subscriptions.push(closePort);
    context.subscriptions.push(compileFile);
    context.subscriptions.push(compileHeroOn);
    context.subscriptions.push(compileHeroOff);
    context.subscriptions.push(beautify);
    context.subscriptions.push(beautifyFile);
    context.subscriptions.push(formattersConfigure);
    context.subscriptions.push(formattersOnFileOpen);
    vscode.workspace.onDidSaveTextDocument((document) => {
        let config = vscode.workspace.getConfiguration("compile-hero");
        let isDisableOnDidSaveTextDocument = config.get("disable-compile-files-on-did-save-code") || "";
        if (isDisableOnDidSaveTextDocument)
            return;
        const { fileName } = document;
        readFileName({ fileName });
    });
    status_1.StatusBarUi.init(vscode.workspace.getConfiguration("compile-hero").get("disable-compile-files-on-did-save-code") || "");
}
exports.activate = activate;
function deactivate() {
    status_1.StatusBarUi.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map