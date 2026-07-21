var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/estraverse/estraverse.js
var require_estraverse = __commonJS({
  "node_modules/estraverse/estraverse.js"(exports) {
    (function clone(exports2) {
      "use strict";
      var Syntax, VisitorOption, VisitorKeys, BREAK, SKIP, REMOVE;
      function deepCopy(obj) {
        var ret = {}, key, val;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            val = obj[key];
            if (typeof val === "object" && val !== null) {
              ret[key] = deepCopy(val);
            } else {
              ret[key] = val;
            }
          }
        }
        return ret;
      }
      function upperBound(array, func) {
        var diff, len, i2, current2;
        len = array.length;
        i2 = 0;
        while (len) {
          diff = len >>> 1;
          current2 = i2 + diff;
          if (func(array[current2])) {
            len = diff;
          } else {
            i2 = current2 + 1;
            len -= diff + 1;
          }
        }
        return i2;
      }
      Syntax = {
        AssignmentExpression: "AssignmentExpression",
        AssignmentPattern: "AssignmentPattern",
        ArrayExpression: "ArrayExpression",
        ArrayPattern: "ArrayPattern",
        ArrowFunctionExpression: "ArrowFunctionExpression",
        AwaitExpression: "AwaitExpression",
        // CAUTION: It's deferred to ES7.
        BlockStatement: "BlockStatement",
        BinaryExpression: "BinaryExpression",
        BreakStatement: "BreakStatement",
        CallExpression: "CallExpression",
        CatchClause: "CatchClause",
        ChainExpression: "ChainExpression",
        ClassBody: "ClassBody",
        ClassDeclaration: "ClassDeclaration",
        ClassExpression: "ClassExpression",
        ComprehensionBlock: "ComprehensionBlock",
        // CAUTION: It's deferred to ES7.
        ComprehensionExpression: "ComprehensionExpression",
        // CAUTION: It's deferred to ES7.
        ConditionalExpression: "ConditionalExpression",
        ContinueStatement: "ContinueStatement",
        DebuggerStatement: "DebuggerStatement",
        DirectiveStatement: "DirectiveStatement",
        DoWhileStatement: "DoWhileStatement",
        EmptyStatement: "EmptyStatement",
        ExportAllDeclaration: "ExportAllDeclaration",
        ExportDefaultDeclaration: "ExportDefaultDeclaration",
        ExportNamedDeclaration: "ExportNamedDeclaration",
        ExportSpecifier: "ExportSpecifier",
        ExpressionStatement: "ExpressionStatement",
        ForStatement: "ForStatement",
        ForInStatement: "ForInStatement",
        ForOfStatement: "ForOfStatement",
        FunctionDeclaration: "FunctionDeclaration",
        FunctionExpression: "FunctionExpression",
        GeneratorExpression: "GeneratorExpression",
        // CAUTION: It's deferred to ES7.
        Identifier: "Identifier",
        IfStatement: "IfStatement",
        ImportExpression: "ImportExpression",
        ImportDeclaration: "ImportDeclaration",
        ImportDefaultSpecifier: "ImportDefaultSpecifier",
        ImportNamespaceSpecifier: "ImportNamespaceSpecifier",
        ImportSpecifier: "ImportSpecifier",
        Literal: "Literal",
        LabeledStatement: "LabeledStatement",
        LogicalExpression: "LogicalExpression",
        MemberExpression: "MemberExpression",
        MetaProperty: "MetaProperty",
        MethodDefinition: "MethodDefinition",
        ModuleSpecifier: "ModuleSpecifier",
        NewExpression: "NewExpression",
        ObjectExpression: "ObjectExpression",
        ObjectPattern: "ObjectPattern",
        PrivateIdentifier: "PrivateIdentifier",
        Program: "Program",
        Property: "Property",
        PropertyDefinition: "PropertyDefinition",
        RestElement: "RestElement",
        ReturnStatement: "ReturnStatement",
        SequenceExpression: "SequenceExpression",
        SpreadElement: "SpreadElement",
        Super: "Super",
        SwitchStatement: "SwitchStatement",
        SwitchCase: "SwitchCase",
        TaggedTemplateExpression: "TaggedTemplateExpression",
        TemplateElement: "TemplateElement",
        TemplateLiteral: "TemplateLiteral",
        ThisExpression: "ThisExpression",
        ThrowStatement: "ThrowStatement",
        TryStatement: "TryStatement",
        UnaryExpression: "UnaryExpression",
        UpdateExpression: "UpdateExpression",
        VariableDeclaration: "VariableDeclaration",
        VariableDeclarator: "VariableDeclarator",
        WhileStatement: "WhileStatement",
        WithStatement: "WithStatement",
        YieldExpression: "YieldExpression"
      };
      VisitorKeys = {
        AssignmentExpression: ["left", "right"],
        AssignmentPattern: ["left", "right"],
        ArrayExpression: ["elements"],
        ArrayPattern: ["elements"],
        ArrowFunctionExpression: ["params", "body"],
        AwaitExpression: ["argument"],
        // CAUTION: It's deferred to ES7.
        BlockStatement: ["body"],
        BinaryExpression: ["left", "right"],
        BreakStatement: ["label"],
        CallExpression: ["callee", "arguments"],
        CatchClause: ["param", "body"],
        ChainExpression: ["expression"],
        ClassBody: ["body"],
        ClassDeclaration: ["id", "superClass", "body"],
        ClassExpression: ["id", "superClass", "body"],
        ComprehensionBlock: ["left", "right"],
        // CAUTION: It's deferred to ES7.
        ComprehensionExpression: ["blocks", "filter", "body"],
        // CAUTION: It's deferred to ES7.
        ConditionalExpression: ["test", "consequent", "alternate"],
        ContinueStatement: ["label"],
        DebuggerStatement: [],
        DirectiveStatement: [],
        DoWhileStatement: ["body", "test"],
        EmptyStatement: [],
        ExportAllDeclaration: ["source"],
        ExportDefaultDeclaration: ["declaration"],
        ExportNamedDeclaration: ["declaration", "specifiers", "source"],
        ExportSpecifier: ["exported", "local"],
        ExpressionStatement: ["expression"],
        ForStatement: ["init", "test", "update", "body"],
        ForInStatement: ["left", "right", "body"],
        ForOfStatement: ["left", "right", "body"],
        FunctionDeclaration: ["id", "params", "body"],
        FunctionExpression: ["id", "params", "body"],
        GeneratorExpression: ["blocks", "filter", "body"],
        // CAUTION: It's deferred to ES7.
        Identifier: [],
        IfStatement: ["test", "consequent", "alternate"],
        ImportExpression: ["source"],
        ImportDeclaration: ["specifiers", "source"],
        ImportDefaultSpecifier: ["local"],
        ImportNamespaceSpecifier: ["local"],
        ImportSpecifier: ["imported", "local"],
        Literal: [],
        LabeledStatement: ["label", "body"],
        LogicalExpression: ["left", "right"],
        MemberExpression: ["object", "property"],
        MetaProperty: ["meta", "property"],
        MethodDefinition: ["key", "value"],
        ModuleSpecifier: [],
        NewExpression: ["callee", "arguments"],
        ObjectExpression: ["properties"],
        ObjectPattern: ["properties"],
        PrivateIdentifier: [],
        Program: ["body"],
        Property: ["key", "value"],
        PropertyDefinition: ["key", "value"],
        RestElement: ["argument"],
        ReturnStatement: ["argument"],
        SequenceExpression: ["expressions"],
        SpreadElement: ["argument"],
        Super: [],
        SwitchStatement: ["discriminant", "cases"],
        SwitchCase: ["test", "consequent"],
        TaggedTemplateExpression: ["tag", "quasi"],
        TemplateElement: [],
        TemplateLiteral: ["quasis", "expressions"],
        ThisExpression: [],
        ThrowStatement: ["argument"],
        TryStatement: ["block", "handler", "finalizer"],
        UnaryExpression: ["argument"],
        UpdateExpression: ["argument"],
        VariableDeclaration: ["declarations"],
        VariableDeclarator: ["id", "init"],
        WhileStatement: ["test", "body"],
        WithStatement: ["object", "body"],
        YieldExpression: ["argument"]
      };
      BREAK = {};
      SKIP = {};
      REMOVE = {};
      VisitorOption = {
        Break: BREAK,
        Skip: SKIP,
        Remove: REMOVE
      };
      function Reference(parent, key) {
        this.parent = parent;
        this.key = key;
      }
      Reference.prototype.replace = function replace2(node) {
        this.parent[this.key] = node;
      };
      Reference.prototype.remove = function remove() {
        if (Array.isArray(this.parent)) {
          this.parent.splice(this.key, 1);
          return true;
        } else {
          this.replace(null);
          return false;
        }
      };
      function Element(node, path, wrap, ref2) {
        this.node = node;
        this.path = path;
        this.wrap = wrap;
        this.ref = ref2;
      }
      function Controller() {
      }
      Controller.prototype.path = function path() {
        var i2, iz, j3, jz, result, element;
        function addToPath(result2, path2) {
          if (Array.isArray(path2)) {
            for (j3 = 0, jz = path2.length; j3 < jz; ++j3) {
              result2.push(path2[j3]);
            }
          } else {
            result2.push(path2);
          }
        }
        if (!this.__current.path) {
          return null;
        }
        result = [];
        for (i2 = 2, iz = this.__leavelist.length; i2 < iz; ++i2) {
          element = this.__leavelist[i2];
          addToPath(result, element.path);
        }
        addToPath(result, this.__current.path);
        return result;
      };
      Controller.prototype.type = function() {
        var node = this.current();
        return node.type || this.__current.wrap;
      };
      Controller.prototype.parents = function parents() {
        var i2, iz, result;
        result = [];
        for (i2 = 1, iz = this.__leavelist.length; i2 < iz; ++i2) {
          result.push(this.__leavelist[i2].node);
        }
        return result;
      };
      Controller.prototype.current = function current2() {
        return this.__current.node;
      };
      Controller.prototype.__execute = function __execute(callback, element) {
        var previous, result;
        result = void 0;
        previous = this.__current;
        this.__current = element;
        this.__state = null;
        if (callback) {
          result = callback.call(this, element.node, this.__leavelist[this.__leavelist.length - 1].node);
        }
        this.__current = previous;
        return result;
      };
      Controller.prototype.notify = function notify(flag) {
        this.__state = flag;
      };
      Controller.prototype.skip = function() {
        this.notify(SKIP);
      };
      Controller.prototype["break"] = function() {
        this.notify(BREAK);
      };
      Controller.prototype.remove = function() {
        this.notify(REMOVE);
      };
      Controller.prototype.__initialize = function(root, visitor) {
        this.visitor = visitor;
        this.root = root;
        this.__worklist = [];
        this.__leavelist = [];
        this.__current = null;
        this.__state = null;
        this.__fallback = null;
        if (visitor.fallback === "iteration") {
          this.__fallback = Object.keys;
        } else if (typeof visitor.fallback === "function") {
          this.__fallback = visitor.fallback;
        }
        this.__keys = VisitorKeys;
        if (visitor.keys) {
          this.__keys = Object.assign(Object.create(this.__keys), visitor.keys);
        }
      };
      function isNode2(node) {
        if (node == null) {
          return false;
        }
        return typeof node === "object" && typeof node.type === "string";
      }
      function isProperty(nodeType, key) {
        return (nodeType === Syntax.ObjectExpression || nodeType === Syntax.ObjectPattern) && "properties" === key;
      }
      function candidateExistsInLeaveList(leavelist, candidate) {
        for (var i2 = leavelist.length - 1; i2 >= 0; --i2) {
          if (leavelist[i2].node === candidate) {
            return true;
          }
        }
        return false;
      }
      Controller.prototype.traverse = function traverse2(root, visitor) {
        var worklist, leavelist, element, node, nodeType, ret, key, current2, current22, candidates, candidate, sentinel;
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        worklist.push(new Element(root, null, null, null));
        leavelist.push(new Element(null, null, null, null));
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            ret = this.__execute(visitor.leave, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            continue;
          }
          if (element.node) {
            ret = this.__execute(visitor.enter, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            worklist.push(sentinel);
            leavelist.push(element);
            if (this.__state === SKIP || ret === SKIP) {
              continue;
            }
            node = element.node;
            nodeType = node.type || element.wrap;
            candidates = this.__keys[nodeType];
            if (!candidates) {
              if (this.__fallback) {
                candidates = this.__fallback(node);
              } else {
                throw new Error("Unknown node type " + nodeType + ".");
              }
            }
            current2 = candidates.length;
            while ((current2 -= 1) >= 0) {
              key = candidates[current2];
              candidate = node[key];
              if (!candidate) {
                continue;
              }
              if (Array.isArray(candidate)) {
                current22 = candidate.length;
                while ((current22 -= 1) >= 0) {
                  if (!candidate[current22]) {
                    continue;
                  }
                  if (candidateExistsInLeaveList(leavelist, candidate[current22])) {
                    continue;
                  }
                  if (isProperty(nodeType, candidates[current2])) {
                    element = new Element(candidate[current22], [key, current22], "Property", null);
                  } else if (isNode2(candidate[current22])) {
                    element = new Element(candidate[current22], [key, current22], null, null);
                  } else {
                    continue;
                  }
                  worklist.push(element);
                }
              } else if (isNode2(candidate)) {
                if (candidateExistsInLeaveList(leavelist, candidate)) {
                  continue;
                }
                worklist.push(new Element(candidate, key, null, null));
              }
            }
          }
        }
      };
      Controller.prototype.replace = function replace2(root, visitor) {
        var worklist, leavelist, node, nodeType, target, element, current2, current22, candidates, candidate, sentinel, outer, key;
        function removeElem(element2) {
          var i2, key2, nextElem, parent;
          if (element2.ref.remove()) {
            key2 = element2.ref.key;
            parent = element2.ref.parent;
            i2 = worklist.length;
            while (i2--) {
              nextElem = worklist[i2];
              if (nextElem.ref && nextElem.ref.parent === parent) {
                if (nextElem.ref.key < key2) {
                  break;
                }
                --nextElem.ref.key;
              }
            }
          }
        }
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        outer = {
          root
        };
        element = new Element(root, null, null, new Reference(outer, "root"));
        worklist.push(element);
        leavelist.push(element);
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            target = this.__execute(visitor.leave, element);
            if (target !== void 0 && target !== BREAK && target !== SKIP && target !== REMOVE) {
              element.ref.replace(target);
            }
            if (this.__state === REMOVE || target === REMOVE) {
              removeElem(element);
            }
            if (this.__state === BREAK || target === BREAK) {
              return outer.root;
            }
            continue;
          }
          target = this.__execute(visitor.enter, element);
          if (target !== void 0 && target !== BREAK && target !== SKIP && target !== REMOVE) {
            element.ref.replace(target);
            element.node = target;
          }
          if (this.__state === REMOVE || target === REMOVE) {
            removeElem(element);
            element.node = null;
          }
          if (this.__state === BREAK || target === BREAK) {
            return outer.root;
          }
          node = element.node;
          if (!node) {
            continue;
          }
          worklist.push(sentinel);
          leavelist.push(element);
          if (this.__state === SKIP || target === SKIP) {
            continue;
          }
          nodeType = node.type || element.wrap;
          candidates = this.__keys[nodeType];
          if (!candidates) {
            if (this.__fallback) {
              candidates = this.__fallback(node);
            } else {
              throw new Error("Unknown node type " + nodeType + ".");
            }
          }
          current2 = candidates.length;
          while ((current2 -= 1) >= 0) {
            key = candidates[current2];
            candidate = node[key];
            if (!candidate) {
              continue;
            }
            if (Array.isArray(candidate)) {
              current22 = candidate.length;
              while ((current22 -= 1) >= 0) {
                if (!candidate[current22]) {
                  continue;
                }
                if (isProperty(nodeType, candidates[current2])) {
                  element = new Element(candidate[current22], [key, current22], "Property", new Reference(candidate, current22));
                } else if (isNode2(candidate[current22])) {
                  element = new Element(candidate[current22], [key, current22], null, new Reference(candidate, current22));
                } else {
                  continue;
                }
                worklist.push(element);
              }
            } else if (isNode2(candidate)) {
              worklist.push(new Element(candidate, key, null, new Reference(node, key)));
            }
          }
        }
        return outer.root;
      };
      function traverse(root, visitor) {
        var controller = new Controller();
        return controller.traverse(root, visitor);
      }
      function replace(root, visitor) {
        var controller = new Controller();
        return controller.replace(root, visitor);
      }
      function extendCommentRange(comment, tokens) {
        var target;
        target = upperBound(tokens, function search(token) {
          return token.range[0] > comment.range[0];
        });
        comment.extendedRange = [comment.range[0], comment.range[1]];
        if (target !== tokens.length) {
          comment.extendedRange[1] = tokens[target].range[0];
        }
        target -= 1;
        if (target >= 0) {
          comment.extendedRange[0] = tokens[target].range[1];
        }
        return comment;
      }
      function attachComments(tree, providedComments, tokens) {
        var comments = [], comment, len, i2, cursor;
        if (!tree.range) {
          throw new Error("attachComments needs range information");
        }
        if (!tokens.length) {
          if (providedComments.length) {
            for (i2 = 0, len = providedComments.length; i2 < len; i2 += 1) {
              comment = deepCopy(providedComments[i2]);
              comment.extendedRange = [0, tree.range[0]];
              comments.push(comment);
            }
            tree.leadingComments = comments;
          }
          return tree;
        }
        for (i2 = 0, len = providedComments.length; i2 < len; i2 += 1) {
          comments.push(extendCommentRange(deepCopy(providedComments[i2]), tokens));
        }
        cursor = 0;
        traverse(tree, {
          enter: function(node) {
            var comment2;
            while (cursor < comments.length) {
              comment2 = comments[cursor];
              if (comment2.extendedRange[1] > node.range[0]) {
                break;
              }
              if (comment2.extendedRange[1] === node.range[0]) {
                if (!node.leadingComments) {
                  node.leadingComments = [];
                }
                node.leadingComments.push(comment2);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        cursor = 0;
        traverse(tree, {
          leave: function(node) {
            var comment2;
            while (cursor < comments.length) {
              comment2 = comments[cursor];
              if (node.range[1] < comment2.extendedRange[0]) {
                break;
              }
              if (node.range[1] === comment2.extendedRange[0]) {
                if (!node.trailingComments) {
                  node.trailingComments = [];
                }
                node.trailingComments.push(comment2);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        return tree;
      }
      exports2.Syntax = Syntax;
      exports2.traverse = traverse;
      exports2.replace = replace;
      exports2.attachComments = attachComments;
      exports2.VisitorKeys = VisitorKeys;
      exports2.VisitorOption = VisitorOption;
      exports2.Controller = Controller;
      exports2.cloneEnvironment = function() {
        return clone({});
      };
      return exports2;
    })(exports);
  }
});

// node_modules/esutils/lib/ast.js
var require_ast = __commonJS({
  "node_modules/esutils/lib/ast.js"(exports, module) {
    (function() {
      "use strict";
      function isExpression(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
          case "ArrayExpression":
          case "AssignmentExpression":
          case "BinaryExpression":
          case "CallExpression":
          case "ConditionalExpression":
          case "FunctionExpression":
          case "Identifier":
          case "Literal":
          case "LogicalExpression":
          case "MemberExpression":
          case "NewExpression":
          case "ObjectExpression":
          case "SequenceExpression":
          case "ThisExpression":
          case "UnaryExpression":
          case "UpdateExpression":
            return true;
        }
        return false;
      }
      function isIterationStatement(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
          case "DoWhileStatement":
          case "ForInStatement":
          case "ForStatement":
          case "WhileStatement":
            return true;
        }
        return false;
      }
      function isStatement(node) {
        if (node == null) {
          return false;
        }
        switch (node.type) {
          case "BlockStatement":
          case "BreakStatement":
          case "ContinueStatement":
          case "DebuggerStatement":
          case "DoWhileStatement":
          case "EmptyStatement":
          case "ExpressionStatement":
          case "ForInStatement":
          case "ForStatement":
          case "IfStatement":
          case "LabeledStatement":
          case "ReturnStatement":
          case "SwitchStatement":
          case "ThrowStatement":
          case "TryStatement":
          case "VariableDeclaration":
          case "WhileStatement":
          case "WithStatement":
            return true;
        }
        return false;
      }
      function isSourceElement(node) {
        return isStatement(node) || node != null && node.type === "FunctionDeclaration";
      }
      function trailingStatement(node) {
        switch (node.type) {
          case "IfStatement":
            if (node.alternate != null) {
              return node.alternate;
            }
            return node.consequent;
          case "LabeledStatement":
          case "ForStatement":
          case "ForInStatement":
          case "WhileStatement":
          case "WithStatement":
            return node.body;
        }
        return null;
      }
      function isProblematicIfStatement(node) {
        var current2;
        if (node.type !== "IfStatement") {
          return false;
        }
        if (node.alternate == null) {
          return false;
        }
        current2 = node.consequent;
        do {
          if (current2.type === "IfStatement") {
            if (current2.alternate == null) {
              return true;
            }
          }
          current2 = trailingStatement(current2);
        } while (current2);
        return false;
      }
      module.exports = {
        isExpression,
        isStatement,
        isIterationStatement,
        isSourceElement,
        isProblematicIfStatement,
        trailingStatement
      };
    })();
  }
});

// node_modules/esutils/lib/code.js
var require_code = __commonJS({
  "node_modules/esutils/lib/code.js"(exports, module) {
    (function() {
      "use strict";
      var ES6Regex, ES5Regex, NON_ASCII_WHITESPACES, IDENTIFIER_START, IDENTIFIER_PART, ch2;
      ES5Regex = {
        // ECMAScript 5.1/Unicode v9.0.0 NonAsciiIdentifierStart:
        NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
        // ECMAScript 5.1/Unicode v9.0.0 NonAsciiIdentifierPart:
        NonAsciiIdentifierPart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/
      };
      ES6Regex = {
        // ECMAScript 6/Unicode v9.0.0 NonAsciiIdentifierStart:
        NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]/,
        // ECMAScript 6/Unicode v9.0.0 NonAsciiIdentifierPart:
        NonAsciiIdentifierPart: /[\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/
      };
      function isDecimalDigit2(ch3) {
        return 48 <= ch3 && ch3 <= 57;
      }
      function isHexDigit2(ch3) {
        return 48 <= ch3 && ch3 <= 57 || // 0..9
        97 <= ch3 && ch3 <= 102 || // a..f
        65 <= ch3 && ch3 <= 70;
      }
      function isOctalDigit2(ch3) {
        return ch3 >= 48 && ch3 <= 55;
      }
      NON_ASCII_WHITESPACES = [
        5760,
        8192,
        8193,
        8194,
        8195,
        8196,
        8197,
        8198,
        8199,
        8200,
        8201,
        8202,
        8239,
        8287,
        12288,
        65279
      ];
      function isWhiteSpace(ch3) {
        return ch3 === 32 || ch3 === 9 || ch3 === 11 || ch3 === 12 || ch3 === 160 || ch3 >= 5760 && NON_ASCII_WHITESPACES.indexOf(ch3) >= 0;
      }
      function isLineTerminator(ch3) {
        return ch3 === 10 || ch3 === 13 || ch3 === 8232 || ch3 === 8233;
      }
      function fromCodePoint(cp2) {
        if (cp2 <= 65535) {
          return String.fromCharCode(cp2);
        }
        var cu1 = String.fromCharCode(Math.floor((cp2 - 65536) / 1024) + 55296);
        var cu22 = String.fromCharCode((cp2 - 65536) % 1024 + 56320);
        return cu1 + cu22;
      }
      IDENTIFIER_START = new Array(128);
      for (ch2 = 0; ch2 < 128; ++ch2) {
        IDENTIFIER_START[ch2] = ch2 >= 97 && ch2 <= 122 || // a..z
        ch2 >= 65 && ch2 <= 90 || // A..Z
        ch2 === 36 || ch2 === 95;
      }
      IDENTIFIER_PART = new Array(128);
      for (ch2 = 0; ch2 < 128; ++ch2) {
        IDENTIFIER_PART[ch2] = ch2 >= 97 && ch2 <= 122 || // a..z
        ch2 >= 65 && ch2 <= 90 || // A..Z
        ch2 >= 48 && ch2 <= 57 || // 0..9
        ch2 === 36 || ch2 === 95;
      }
      function isIdentifierStartES5(ch3) {
        return ch3 < 128 ? IDENTIFIER_START[ch3] : ES5Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch3));
      }
      function isIdentifierPartES5(ch3) {
        return ch3 < 128 ? IDENTIFIER_PART[ch3] : ES5Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch3));
      }
      function isIdentifierStartES6(ch3) {
        return ch3 < 128 ? IDENTIFIER_START[ch3] : ES6Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch3));
      }
      function isIdentifierPartES6(ch3) {
        return ch3 < 128 ? IDENTIFIER_PART[ch3] : ES6Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch3));
      }
      module.exports = {
        isDecimalDigit: isDecimalDigit2,
        isHexDigit: isHexDigit2,
        isOctalDigit: isOctalDigit2,
        isWhiteSpace,
        isLineTerminator,
        isIdentifierStartES5,
        isIdentifierPartES5,
        isIdentifierStartES6,
        isIdentifierPartES6
      };
    })();
  }
});

// node_modules/esutils/lib/keyword.js
var require_keyword = __commonJS({
  "node_modules/esutils/lib/keyword.js"(exports, module) {
    (function() {
      "use strict";
      var code2 = require_code();
      function isStrictModeReservedWordES6(id2) {
        switch (id2) {
          case "implements":
          case "interface":
          case "package":
          case "private":
          case "protected":
          case "public":
          case "static":
          case "let":
            return true;
          default:
            return false;
        }
      }
      function isKeywordES5(id2, strict) {
        if (!strict && id2 === "yield") {
          return false;
        }
        return isKeywordES6(id2, strict);
      }
      function isKeywordES6(id2, strict) {
        if (strict && isStrictModeReservedWordES6(id2)) {
          return true;
        }
        switch (id2.length) {
          case 2:
            return id2 === "if" || id2 === "in" || id2 === "do";
          case 3:
            return id2 === "var" || id2 === "for" || id2 === "new" || id2 === "try";
          case 4:
            return id2 === "this" || id2 === "else" || id2 === "case" || id2 === "void" || id2 === "with" || id2 === "enum";
          case 5:
            return id2 === "while" || id2 === "break" || id2 === "catch" || id2 === "throw" || id2 === "const" || id2 === "yield" || id2 === "class" || id2 === "super";
          case 6:
            return id2 === "return" || id2 === "typeof" || id2 === "delete" || id2 === "switch" || id2 === "export" || id2 === "import";
          case 7:
            return id2 === "default" || id2 === "finally" || id2 === "extends";
          case 8:
            return id2 === "function" || id2 === "continue" || id2 === "debugger";
          case 10:
            return id2 === "instanceof";
          default:
            return false;
        }
      }
      function isReservedWordES5(id2, strict) {
        return id2 === "null" || id2 === "true" || id2 === "false" || isKeywordES5(id2, strict);
      }
      function isReservedWordES6(id2, strict) {
        return id2 === "null" || id2 === "true" || id2 === "false" || isKeywordES6(id2, strict);
      }
      function isRestrictedWord(id2) {
        return id2 === "eval" || id2 === "arguments";
      }
      function isIdentifierNameES5(id2) {
        var i2, iz, ch2;
        if (id2.length === 0) {
          return false;
        }
        ch2 = id2.charCodeAt(0);
        if (!code2.isIdentifierStartES5(ch2)) {
          return false;
        }
        for (i2 = 1, iz = id2.length; i2 < iz; ++i2) {
          ch2 = id2.charCodeAt(i2);
          if (!code2.isIdentifierPartES5(ch2)) {
            return false;
          }
        }
        return true;
      }
      function decodeUtf16(lead, trail) {
        return (lead - 55296) * 1024 + (trail - 56320) + 65536;
      }
      function isIdentifierNameES6(id2) {
        var i2, iz, ch2, lowCh, check;
        if (id2.length === 0) {
          return false;
        }
        check = code2.isIdentifierStartES6;
        for (i2 = 0, iz = id2.length; i2 < iz; ++i2) {
          ch2 = id2.charCodeAt(i2);
          if (55296 <= ch2 && ch2 <= 56319) {
            ++i2;
            if (i2 >= iz) {
              return false;
            }
            lowCh = id2.charCodeAt(i2);
            if (!(56320 <= lowCh && lowCh <= 57343)) {
              return false;
            }
            ch2 = decodeUtf16(ch2, lowCh);
          }
          if (!check(ch2)) {
            return false;
          }
          check = code2.isIdentifierPartES6;
        }
        return true;
      }
      function isIdentifierES5(id2, strict) {
        return isIdentifierNameES5(id2) && !isReservedWordES5(id2, strict);
      }
      function isIdentifierES6(id2, strict) {
        return isIdentifierNameES6(id2) && !isReservedWordES6(id2, strict);
      }
      module.exports = {
        isKeywordES5,
        isKeywordES6,
        isReservedWordES5,
        isReservedWordES6,
        isRestrictedWord,
        isIdentifierNameES5,
        isIdentifierNameES6,
        isIdentifierES5,
        isIdentifierES6
      };
    })();
  }
});

// node_modules/esutils/lib/utils.js
var require_utils = __commonJS({
  "node_modules/esutils/lib/utils.js"(exports) {
    (function() {
      "use strict";
      exports.ast = require_ast();
      exports.code = require_code();
      exports.keyword = require_keyword();
    })();
  }
});

// node_modules/source-map/lib/base64.js
var require_base64 = __commonJS({
  "node_modules/source-map/lib/base64.js"(exports) {
    var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    exports.encode = function(number) {
      if (0 <= number && number < intToCharMap.length) {
        return intToCharMap[number];
      }
      throw new TypeError("Must be between 0 and 63: " + number);
    };
    exports.decode = function(charCode) {
      var bigA = 65;
      var bigZ = 90;
      var littleA = 97;
      var littleZ = 122;
      var zero = 48;
      var nine = 57;
      var plus = 43;
      var slash = 47;
      var littleOffset = 26;
      var numberOffset = 52;
      if (bigA <= charCode && charCode <= bigZ) {
        return charCode - bigA;
      }
      if (littleA <= charCode && charCode <= littleZ) {
        return charCode - littleA + littleOffset;
      }
      if (zero <= charCode && charCode <= nine) {
        return charCode - zero + numberOffset;
      }
      if (charCode == plus) {
        return 62;
      }
      if (charCode == slash) {
        return 63;
      }
      return -1;
    };
  }
});

// node_modules/source-map/lib/base64-vlq.js
var require_base64_vlq = __commonJS({
  "node_modules/source-map/lib/base64-vlq.js"(exports) {
    var base64 = require_base64();
    var VLQ_BASE_SHIFT = 5;
    var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
    var VLQ_BASE_MASK = VLQ_BASE - 1;
    var VLQ_CONTINUATION_BIT = VLQ_BASE;
    function toVLQSigned(aValue) {
      return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
    }
    function fromVLQSigned(aValue) {
      var isNegative = (aValue & 1) === 1;
      var shifted = aValue >> 1;
      return isNegative ? -shifted : shifted;
    }
    exports.encode = function base64VLQ_encode(aValue) {
      var encoded = "";
      var digit;
      var vlq = toVLQSigned(aValue);
      do {
        digit = vlq & VLQ_BASE_MASK;
        vlq >>>= VLQ_BASE_SHIFT;
        if (vlq > 0) {
          digit |= VLQ_CONTINUATION_BIT;
        }
        encoded += base64.encode(digit);
      } while (vlq > 0);
      return encoded;
    };
    exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
      var strLen = aStr.length;
      var result = 0;
      var shift = 0;
      var continuation, digit;
      do {
        if (aIndex >= strLen) {
          throw new Error("Expected more digits in base 64 VLQ value.");
        }
        digit = base64.decode(aStr.charCodeAt(aIndex++));
        if (digit === -1) {
          throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
        }
        continuation = !!(digit & VLQ_CONTINUATION_BIT);
        digit &= VLQ_BASE_MASK;
        result = result + (digit << shift);
        shift += VLQ_BASE_SHIFT;
      } while (continuation);
      aOutParam.value = fromVLQSigned(result);
      aOutParam.rest = aIndex;
    };
  }
});

// node_modules/source-map/lib/util.js
var require_util = __commonJS({
  "node_modules/source-map/lib/util.js"(exports) {
    function getArg(aArgs, aName, aDefaultValue) {
      if (aName in aArgs) {
        return aArgs[aName];
      } else if (arguments.length === 3) {
        return aDefaultValue;
      } else {
        throw new Error('"' + aName + '" is a required argument.');
      }
    }
    exports.getArg = getArg;
    var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
    var dataUrlRegexp = /^data:.+\,.+$/;
    function urlParse(aUrl) {
      var match = aUrl.match(urlRegexp);
      if (!match) {
        return null;
      }
      return {
        scheme: match[1],
        auth: match[2],
        host: match[3],
        port: match[4],
        path: match[5]
      };
    }
    exports.urlParse = urlParse;
    function urlGenerate(aParsedUrl) {
      var url = "";
      if (aParsedUrl.scheme) {
        url += aParsedUrl.scheme + ":";
      }
      url += "//";
      if (aParsedUrl.auth) {
        url += aParsedUrl.auth + "@";
      }
      if (aParsedUrl.host) {
        url += aParsedUrl.host;
      }
      if (aParsedUrl.port) {
        url += ":" + aParsedUrl.port;
      }
      if (aParsedUrl.path) {
        url += aParsedUrl.path;
      }
      return url;
    }
    exports.urlGenerate = urlGenerate;
    function normalize(aPath) {
      var path = aPath;
      var url = urlParse(aPath);
      if (url) {
        if (!url.path) {
          return aPath;
        }
        path = url.path;
      }
      var isAbsolute = exports.isAbsolute(path);
      var parts = path.split(/\/+/);
      for (var part, up2 = 0, i2 = parts.length - 1; i2 >= 0; i2--) {
        part = parts[i2];
        if (part === ".") {
          parts.splice(i2, 1);
        } else if (part === "..") {
          up2++;
        } else if (up2 > 0) {
          if (part === "") {
            parts.splice(i2 + 1, up2);
            up2 = 0;
          } else {
            parts.splice(i2, 2);
            up2--;
          }
        }
      }
      path = parts.join("/");
      if (path === "") {
        path = isAbsolute ? "/" : ".";
      }
      if (url) {
        url.path = path;
        return urlGenerate(url);
      }
      return path;
    }
    exports.normalize = normalize;
    function join(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      if (aPath === "") {
        aPath = ".";
      }
      var aPathUrl = urlParse(aPath);
      var aRootUrl = urlParse(aRoot);
      if (aRootUrl) {
        aRoot = aRootUrl.path || "/";
      }
      if (aPathUrl && !aPathUrl.scheme) {
        if (aRootUrl) {
          aPathUrl.scheme = aRootUrl.scheme;
        }
        return urlGenerate(aPathUrl);
      }
      if (aPathUrl || aPath.match(dataUrlRegexp)) {
        return aPath;
      }
      if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
        aRootUrl.host = aPath;
        return urlGenerate(aRootUrl);
      }
      var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
      if (aRootUrl) {
        aRootUrl.path = joined;
        return urlGenerate(aRootUrl);
      }
      return joined;
    }
    exports.join = join;
    exports.isAbsolute = function(aPath) {
      return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
    };
    function relative(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      aRoot = aRoot.replace(/\/$/, "");
      var level = 0;
      while (aPath.indexOf(aRoot + "/") !== 0) {
        var index = aRoot.lastIndexOf("/");
        if (index < 0) {
          return aPath;
        }
        aRoot = aRoot.slice(0, index);
        if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
          return aPath;
        }
        ++level;
      }
      return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
    }
    exports.relative = relative;
    var supportsNullProto = (function() {
      var obj = /* @__PURE__ */ Object.create(null);
      return !("__proto__" in obj);
    })();
    function identity(s) {
      return s;
    }
    function toSetString(aStr) {
      if (isProtoString(aStr)) {
        return "$" + aStr;
      }
      return aStr;
    }
    exports.toSetString = supportsNullProto ? identity : toSetString;
    function fromSetString(aStr) {
      if (isProtoString(aStr)) {
        return aStr.slice(1);
      }
      return aStr;
    }
    exports.fromSetString = supportsNullProto ? identity : fromSetString;
    function isProtoString(s) {
      if (!s) {
        return false;
      }
      var length = s.length;
      if (length < 9) {
        return false;
      }
      if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
        return false;
      }
      for (var i2 = length - 10; i2 >= 0; i2--) {
        if (s.charCodeAt(i2) !== 36) {
          return false;
        }
      }
      return true;
    }
    function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
      var cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0 || onlyCompareOriginal) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByOriginalPositions = compareByOriginalPositions;
    function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0 || onlyCompareGenerated) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;
    function strcmp(aStr1, aStr2) {
      if (aStr1 === aStr2) {
        return 0;
      }
      if (aStr1 === null) {
        return 1;
      }
      if (aStr2 === null) {
        return -1;
      }
      if (aStr1 > aStr2) {
        return 1;
      }
      return -1;
    }
    function compareByGeneratedPositionsInflated(mappingA, mappingB) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
    function parseSourceMapInput(str) {
      return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
    }
    exports.parseSourceMapInput = parseSourceMapInput;
    function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
      sourceURL = sourceURL || "";
      if (sourceRoot) {
        if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
          sourceRoot += "/";
        }
        sourceURL = sourceRoot + sourceURL;
      }
      if (sourceMapURL) {
        var parsed = urlParse(sourceMapURL);
        if (!parsed) {
          throw new Error("sourceMapURL could not be parsed");
        }
        if (parsed.path) {
          var index = parsed.path.lastIndexOf("/");
          if (index >= 0) {
            parsed.path = parsed.path.substring(0, index + 1);
          }
        }
        sourceURL = join(urlGenerate(parsed), sourceURL);
      }
      return normalize(sourceURL);
    }
    exports.computeSourceURL = computeSourceURL;
  }
});

// node_modules/source-map/lib/array-set.js
var require_array_set = __commonJS({
  "node_modules/source-map/lib/array-set.js"(exports) {
    var util = require_util();
    var has = Object.prototype.hasOwnProperty;
    var hasNativeMap = typeof Map !== "undefined";
    function ArraySet() {
      this._array = [];
      this._set = hasNativeMap ? /* @__PURE__ */ new Map() : /* @__PURE__ */ Object.create(null);
    }
    ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
      var set = new ArraySet();
      for (var i2 = 0, len = aArray.length; i2 < len; i2++) {
        set.add(aArray[i2], aAllowDuplicates);
      }
      return set;
    };
    ArraySet.prototype.size = function ArraySet_size() {
      return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
    };
    ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
      var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
      var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
      var idx = this._array.length;
      if (!isDuplicate || aAllowDuplicates) {
        this._array.push(aStr);
      }
      if (!isDuplicate) {
        if (hasNativeMap) {
          this._set.set(aStr, idx);
        } else {
          this._set[sStr] = idx;
        }
      }
    };
    ArraySet.prototype.has = function ArraySet_has(aStr) {
      if (hasNativeMap) {
        return this._set.has(aStr);
      } else {
        var sStr = util.toSetString(aStr);
        return has.call(this._set, sStr);
      }
    };
    ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
      if (hasNativeMap) {
        var idx = this._set.get(aStr);
        if (idx >= 0) {
          return idx;
        }
      } else {
        var sStr = util.toSetString(aStr);
        if (has.call(this._set, sStr)) {
          return this._set[sStr];
        }
      }
      throw new Error('"' + aStr + '" is not in the set.');
    };
    ArraySet.prototype.at = function ArraySet_at(aIdx) {
      if (aIdx >= 0 && aIdx < this._array.length) {
        return this._array[aIdx];
      }
      throw new Error("No element indexed by " + aIdx);
    };
    ArraySet.prototype.toArray = function ArraySet_toArray() {
      return this._array.slice();
    };
    exports.ArraySet = ArraySet;
  }
});

// node_modules/source-map/lib/mapping-list.js
var require_mapping_list = __commonJS({
  "node_modules/source-map/lib/mapping-list.js"(exports) {
    var util = require_util();
    function generatedPositionAfter(mappingA, mappingB) {
      var lineA = mappingA.generatedLine;
      var lineB = mappingB.generatedLine;
      var columnA = mappingA.generatedColumn;
      var columnB = mappingB.generatedColumn;
      return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
    }
    function MappingList() {
      this._array = [];
      this._sorted = true;
      this._last = { generatedLine: -1, generatedColumn: 0 };
    }
    MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
      this._array.forEach(aCallback, aThisArg);
    };
    MappingList.prototype.add = function MappingList_add(aMapping) {
      if (generatedPositionAfter(this._last, aMapping)) {
        this._last = aMapping;
        this._array.push(aMapping);
      } else {
        this._sorted = false;
        this._array.push(aMapping);
      }
    };
    MappingList.prototype.toArray = function MappingList_toArray() {
      if (!this._sorted) {
        this._array.sort(util.compareByGeneratedPositionsInflated);
        this._sorted = true;
      }
      return this._array;
    };
    exports.MappingList = MappingList;
  }
});

// node_modules/source-map/lib/source-map-generator.js
var require_source_map_generator = __commonJS({
  "node_modules/source-map/lib/source-map-generator.js"(exports) {
    var base64VLQ = require_base64_vlq();
    var util = require_util();
    var ArraySet = require_array_set().ArraySet;
    var MappingList = require_mapping_list().MappingList;
    function SourceMapGenerator(aArgs) {
      if (!aArgs) {
        aArgs = {};
      }
      this._file = util.getArg(aArgs, "file", null);
      this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
      this._skipValidation = util.getArg(aArgs, "skipValidation", false);
      this._sources = new ArraySet();
      this._names = new ArraySet();
      this._mappings = new MappingList();
      this._sourcesContents = null;
    }
    SourceMapGenerator.prototype._version = 3;
    SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot
      });
      aSourceMapConsumer.eachMapping(function(mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };
        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }
          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };
          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }
        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function(sourceFile) {
        var sourceRelative = sourceFile;
        if (sourceRoot !== null) {
          sourceRelative = util.relative(sourceRoot, sourceFile);
        }
        if (!generator._sources.has(sourceRelative)) {
          generator._sources.add(sourceRelative);
        }
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };
    SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, "generated");
      var original = util.getArg(aArgs, "original", null);
      var source = util.getArg(aArgs, "source", null);
      var name = util.getArg(aArgs, "name", null);
      if (!this._skipValidation) {
        this._validateMapping(generated, original, source, name);
      }
      if (source != null) {
        source = String(source);
        if (!this._sources.has(source)) {
          this._sources.add(source);
        }
      }
      if (name != null) {
        name = String(name);
        if (!this._names.has(name)) {
          this._names.add(name);
        }
      }
      this._mappings.add({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source,
        name
      });
    };
    SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }
      if (aSourceContent != null) {
        if (!this._sourcesContents) {
          this._sourcesContents = /* @__PURE__ */ Object.create(null);
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else if (this._sourcesContents) {
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };
    SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            `SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's "file" property. Both were omitted.`
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      var newSources = new ArraySet();
      var newNames = new ArraySet();
      this._mappings.unsortedForEach(function(mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source);
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null) {
              mapping.name = original.name;
            }
          }
        }
        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }
        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }
      }, this);
      this._sources = newSources;
      this._names = newNames;
      aSourceMapConsumer.sources.forEach(function(sourceFile2) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile2);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile2 = util.join(aSourceMapPath, sourceFile2);
          }
          if (sourceRoot != null) {
            sourceFile2 = util.relative(sourceRoot, sourceFile2);
          }
          this.setSourceContent(sourceFile2, content);
        }
      }, this);
    };
    SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
      if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
        throw new Error(
          "original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values."
        );
      }
      if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
        return;
      } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
        return;
      } else {
        throw new Error("Invalid mapping: " + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };
    SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = "";
      var next;
      var mapping;
      var nameIdx;
      var sourceIdx;
      var mappings = this._mappings.toArray();
      for (var i2 = 0, len = mappings.length; i2 < len; i2++) {
        mapping = mappings[i2];
        next = "";
        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            next += ";";
            previousGeneratedLine++;
          }
        } else {
          if (i2 > 0) {
            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i2 - 1])) {
              continue;
            }
            next += ",";
          }
        }
        next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;
        if (mapping.source != null) {
          sourceIdx = this._sources.indexOf(mapping.source);
          next += base64VLQ.encode(sourceIdx - previousSource);
          previousSource = sourceIdx;
          next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;
          next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;
          if (mapping.name != null) {
            nameIdx = this._names.indexOf(mapping.name);
            next += base64VLQ.encode(nameIdx - previousName);
            previousName = nameIdx;
          }
        }
        result += next;
      }
      return result;
    };
    SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function(source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
      }, this);
    };
    SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }
      return map;
    };
    SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
      return JSON.stringify(this.toJSON());
    };
    exports.SourceMapGenerator = SourceMapGenerator;
  }
});

// node_modules/source-map/lib/binary-search.js
var require_binary_search = __commonJS({
  "node_modules/source-map/lib/binary-search.js"(exports) {
    exports.GREATEST_LOWER_BOUND = 1;
    exports.LEAST_UPPER_BOUND = 2;
    function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
      var mid = Math.floor((aHigh - aLow) / 2) + aLow;
      var cmp = aCompare(aNeedle, aHaystack[mid], true);
      if (cmp === 0) {
        return mid;
      } else if (cmp > 0) {
        if (aHigh - mid > 1) {
          return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
        }
        if (aBias == exports.LEAST_UPPER_BOUND) {
          return aHigh < aHaystack.length ? aHigh : -1;
        } else {
          return mid;
        }
      } else {
        if (mid - aLow > 1) {
          return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
        }
        if (aBias == exports.LEAST_UPPER_BOUND) {
          return mid;
        } else {
          return aLow < 0 ? -1 : aLow;
        }
      }
    }
    exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
      if (aHaystack.length === 0) {
        return -1;
      }
      var index = recursiveSearch(
        -1,
        aHaystack.length,
        aNeedle,
        aHaystack,
        aCompare,
        aBias || exports.GREATEST_LOWER_BOUND
      );
      if (index < 0) {
        return -1;
      }
      while (index - 1 >= 0) {
        if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
          break;
        }
        --index;
      }
      return index;
    };
  }
});

// node_modules/source-map/lib/quick-sort.js
var require_quick_sort = __commonJS({
  "node_modules/source-map/lib/quick-sort.js"(exports) {
    function swap(ary, x, y) {
      var temp = ary[x];
      ary[x] = ary[y];
      ary[y] = temp;
    }
    function randomIntInRange(low, high) {
      return Math.round(low + Math.random() * (high - low));
    }
    function doQuickSort(ary, comparator, p, r) {
      if (p < r) {
        var pivotIndex = randomIntInRange(p, r);
        var i2 = p - 1;
        swap(ary, pivotIndex, r);
        var pivot = ary[r];
        for (var j3 = p; j3 < r; j3++) {
          if (comparator(ary[j3], pivot) <= 0) {
            i2 += 1;
            swap(ary, i2, j3);
          }
        }
        swap(ary, i2 + 1, j3);
        var q3 = i2 + 1;
        doQuickSort(ary, comparator, p, q3 - 1);
        doQuickSort(ary, comparator, q3 + 1, r);
      }
    }
    exports.quickSort = function(ary, comparator) {
      doQuickSort(ary, comparator, 0, ary.length - 1);
    };
  }
});

// node_modules/source-map/lib/source-map-consumer.js
var require_source_map_consumer = __commonJS({
  "node_modules/source-map/lib/source-map-consumer.js"(exports) {
    var util = require_util();
    var binarySearch = require_binary_search();
    var ArraySet = require_array_set().ArraySet;
    var base64VLQ = require_base64_vlq();
    var quickSort = require_quick_sort().quickSort;
    function SourceMapConsumer(aSourceMap, aSourceMapURL) {
      var sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util.parseSourceMapInput(aSourceMap);
      }
      return sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
    }
    SourceMapConsumer.fromSourceMap = function(aSourceMap, aSourceMapURL) {
      return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
    };
    SourceMapConsumer.prototype._version = 3;
    SourceMapConsumer.prototype.__generatedMappings = null;
    Object.defineProperty(SourceMapConsumer.prototype, "_generatedMappings", {
      configurable: true,
      enumerable: true,
      get: function() {
        if (!this.__generatedMappings) {
          this._parseMappings(this._mappings, this.sourceRoot);
        }
        return this.__generatedMappings;
      }
    });
    SourceMapConsumer.prototype.__originalMappings = null;
    Object.defineProperty(SourceMapConsumer.prototype, "_originalMappings", {
      configurable: true,
      enumerable: true,
      get: function() {
        if (!this.__originalMappings) {
          this._parseMappings(this._mappings, this.sourceRoot);
        }
        return this.__originalMappings;
      }
    });
    SourceMapConsumer.prototype._charIsMappingSeparator = function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
      var c2 = aStr.charAt(index);
      return c2 === ";" || c2 === ",";
    };
    SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      throw new Error("Subclasses must implement _parseMappings");
    };
    SourceMapConsumer.GENERATED_ORDER = 1;
    SourceMapConsumer.ORIGINAL_ORDER = 2;
    SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
    SourceMapConsumer.LEAST_UPPER_BOUND = 2;
    SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
      var mappings;
      switch (order) {
        case SourceMapConsumer.GENERATED_ORDER:
          mappings = this._generatedMappings;
          break;
        case SourceMapConsumer.ORIGINAL_ORDER:
          mappings = this._originalMappings;
          break;
        default:
          throw new Error("Unknown order of iteration.");
      }
      var sourceRoot = this.sourceRoot;
      mappings.map(function(mapping) {
        var source = mapping.source === null ? null : this._sources.at(mapping.source);
        source = util.computeSourceURL(sourceRoot, source, this._sourceMapURL);
        return {
          source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name === null ? null : this._names.at(mapping.name)
        };
      }, this).forEach(aCallback, context);
    };
    SourceMapConsumer.prototype.allGeneratedPositionsFor = function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
      var line = util.getArg(aArgs, "line");
      var needle = {
        source: util.getArg(aArgs, "source"),
        originalLine: line,
        originalColumn: util.getArg(aArgs, "column", 0)
      };
      needle.source = this._findSourceIndex(needle.source);
      if (needle.source < 0) {
        return [];
      }
      var mappings = [];
      var index = this._findMapping(
        needle,
        this._originalMappings,
        "originalLine",
        "originalColumn",
        util.compareByOriginalPositions,
        binarySearch.LEAST_UPPER_BOUND
      );
      if (index >= 0) {
        var mapping = this._originalMappings[index];
        if (aArgs.column === void 0) {
          var originalLine = mapping.originalLine;
          while (mapping && mapping.originalLine === originalLine) {
            mappings.push({
              line: util.getArg(mapping, "generatedLine", null),
              column: util.getArg(mapping, "generatedColumn", null),
              lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
            });
            mapping = this._originalMappings[++index];
          }
        } else {
          var originalColumn = mapping.originalColumn;
          while (mapping && mapping.originalLine === line && mapping.originalColumn == originalColumn) {
            mappings.push({
              line: util.getArg(mapping, "generatedLine", null),
              column: util.getArg(mapping, "generatedColumn", null),
              lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
            });
            mapping = this._originalMappings[++index];
          }
        }
      }
      return mappings;
    };
    exports.SourceMapConsumer = SourceMapConsumer;
    function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
      var sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util.parseSourceMapInput(aSourceMap);
      }
      var version2 = util.getArg(sourceMap, "version");
      var sources = util.getArg(sourceMap, "sources");
      var names = util.getArg(sourceMap, "names", []);
      var sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
      var sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
      var mappings = util.getArg(sourceMap, "mappings");
      var file = util.getArg(sourceMap, "file", null);
      if (version2 != this._version) {
        throw new Error("Unsupported version: " + version2);
      }
      if (sourceRoot) {
        sourceRoot = util.normalize(sourceRoot);
      }
      sources = sources.map(String).map(util.normalize).map(function(source) {
        return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source) ? util.relative(sourceRoot, source) : source;
      });
      this._names = ArraySet.fromArray(names.map(String), true);
      this._sources = ArraySet.fromArray(sources, true);
      this._absoluteSources = this._sources.toArray().map(function(s) {
        return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
      });
      this.sourceRoot = sourceRoot;
      this.sourcesContent = sourcesContent;
      this._mappings = mappings;
      this._sourceMapURL = aSourceMapURL;
      this.file = file;
    }
    BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
    BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
    BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
      var relativeSource = aSource;
      if (this.sourceRoot != null) {
        relativeSource = util.relative(this.sourceRoot, relativeSource);
      }
      if (this._sources.has(relativeSource)) {
        return this._sources.indexOf(relativeSource);
      }
      var i2;
      for (i2 = 0; i2 < this._absoluteSources.length; ++i2) {
        if (this._absoluteSources[i2] == aSource) {
          return i2;
        }
      }
      return -1;
    };
    BasicSourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
      var smc = Object.create(BasicSourceMapConsumer.prototype);
      var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(
        smc._sources.toArray(),
        smc.sourceRoot
      );
      smc.file = aSourceMap._file;
      smc._sourceMapURL = aSourceMapURL;
      smc._absoluteSources = smc._sources.toArray().map(function(s) {
        return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL);
      });
      var generatedMappings = aSourceMap._mappings.toArray().slice();
      var destGeneratedMappings = smc.__generatedMappings = [];
      var destOriginalMappings = smc.__originalMappings = [];
      for (var i2 = 0, length = generatedMappings.length; i2 < length; i2++) {
        var srcMapping = generatedMappings[i2];
        var destMapping = new Mapping();
        destMapping.generatedLine = srcMapping.generatedLine;
        destMapping.generatedColumn = srcMapping.generatedColumn;
        if (srcMapping.source) {
          destMapping.source = sources.indexOf(srcMapping.source);
          destMapping.originalLine = srcMapping.originalLine;
          destMapping.originalColumn = srcMapping.originalColumn;
          if (srcMapping.name) {
            destMapping.name = names.indexOf(srcMapping.name);
          }
          destOriginalMappings.push(destMapping);
        }
        destGeneratedMappings.push(destMapping);
      }
      quickSort(smc.__originalMappings, util.compareByOriginalPositions);
      return smc;
    };
    BasicSourceMapConsumer.prototype._version = 3;
    Object.defineProperty(BasicSourceMapConsumer.prototype, "sources", {
      get: function() {
        return this._absoluteSources.slice();
      }
    });
    function Mapping() {
      this.generatedLine = 0;
      this.generatedColumn = 0;
      this.source = null;
      this.originalLine = null;
      this.originalColumn = null;
      this.name = null;
    }
    BasicSourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var length = aStr.length;
      var index = 0;
      var cachedSegments = {};
      var temp = {};
      var originalMappings = [];
      var generatedMappings = [];
      var mapping, str, segment, end, value;
      while (index < length) {
        if (aStr.charAt(index) === ";") {
          generatedLine++;
          index++;
          previousGeneratedColumn = 0;
        } else if (aStr.charAt(index) === ",") {
          index++;
        } else {
          mapping = new Mapping();
          mapping.generatedLine = generatedLine;
          for (end = index; end < length; end++) {
            if (this._charIsMappingSeparator(aStr, end)) {
              break;
            }
          }
          str = aStr.slice(index, end);
          segment = cachedSegments[str];
          if (segment) {
            index += str.length;
          } else {
            segment = [];
            while (index < end) {
              base64VLQ.decode(aStr, index, temp);
              value = temp.value;
              index = temp.rest;
              segment.push(value);
            }
            if (segment.length === 2) {
              throw new Error("Found a source, but no line and column");
            }
            if (segment.length === 3) {
              throw new Error("Found a source and line, but no column");
            }
            cachedSegments[str] = segment;
          }
          mapping.generatedColumn = previousGeneratedColumn + segment[0];
          previousGeneratedColumn = mapping.generatedColumn;
          if (segment.length > 1) {
            mapping.source = previousSource + segment[1];
            previousSource += segment[1];
            mapping.originalLine = previousOriginalLine + segment[2];
            previousOriginalLine = mapping.originalLine;
            mapping.originalLine += 1;
            mapping.originalColumn = previousOriginalColumn + segment[3];
            previousOriginalColumn = mapping.originalColumn;
            if (segment.length > 4) {
              mapping.name = previousName + segment[4];
              previousName += segment[4];
            }
          }
          generatedMappings.push(mapping);
          if (typeof mapping.originalLine === "number") {
            originalMappings.push(mapping);
          }
        }
      }
      quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
      this.__generatedMappings = generatedMappings;
      quickSort(originalMappings, util.compareByOriginalPositions);
      this.__originalMappings = originalMappings;
    };
    BasicSourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator, aBias) {
      if (aNeedle[aLineName] <= 0) {
        throw new TypeError("Line must be greater than or equal to 1, got " + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError("Column must be greater than or equal to 0, got " + aNeedle[aColumnName]);
      }
      return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
    };
    BasicSourceMapConsumer.prototype.computeColumnSpans = function SourceMapConsumer_computeColumnSpans() {
      for (var index = 0; index < this._generatedMappings.length; ++index) {
        var mapping = this._generatedMappings[index];
        if (index + 1 < this._generatedMappings.length) {
          var nextMapping = this._generatedMappings[index + 1];
          if (mapping.generatedLine === nextMapping.generatedLine) {
            mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
            continue;
          }
        }
        mapping.lastGeneratedColumn = Infinity;
      }
    };
    BasicSourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, "line"),
        generatedColumn: util.getArg(aArgs, "column")
      };
      var index = this._findMapping(
        needle,
        this._generatedMappings,
        "generatedLine",
        "generatedColumn",
        util.compareByGeneratedPositionsDeflated,
        util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND)
      );
      if (index >= 0) {
        var mapping = this._generatedMappings[index];
        if (mapping.generatedLine === needle.generatedLine) {
          var source = util.getArg(mapping, "source", null);
          if (source !== null) {
            source = this._sources.at(source);
            source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
          }
          var name = util.getArg(mapping, "name", null);
          if (name !== null) {
            name = this._names.at(name);
          }
          return {
            source,
            line: util.getArg(mapping, "originalLine", null),
            column: util.getArg(mapping, "originalColumn", null),
            name
          };
        }
      }
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };
    BasicSourceMapConsumer.prototype.hasContentsOfAllSources = function BasicSourceMapConsumer_hasContentsOfAllSources() {
      if (!this.sourcesContent) {
        return false;
      }
      return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc2) {
        return sc2 == null;
      });
    };
    BasicSourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      if (!this.sourcesContent) {
        return null;
      }
      var index = this._findSourceIndex(aSource);
      if (index >= 0) {
        return this.sourcesContent[index];
      }
      var relativeSource = aSource;
      if (this.sourceRoot != null) {
        relativeSource = util.relative(this.sourceRoot, relativeSource);
      }
      var url;
      if (this.sourceRoot != null && (url = util.urlParse(this.sourceRoot))) {
        var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
        if (url.scheme == "file" && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
        }
        if ((!url.path || url.path == "/") && this._sources.has("/" + relativeSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
        }
      }
      if (nullOnMissing) {
        return null;
      } else {
        throw new Error('"' + relativeSource + '" is not in the SourceMap.');
      }
    };
    BasicSourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
      var source = util.getArg(aArgs, "source");
      source = this._findSourceIndex(source);
      if (source < 0) {
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      }
      var needle = {
        source,
        originalLine: util.getArg(aArgs, "line"),
        originalColumn: util.getArg(aArgs, "column")
      };
      var index = this._findMapping(
        needle,
        this._originalMappings,
        "originalLine",
        "originalColumn",
        util.compareByOriginalPositions,
        util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND)
      );
      if (index >= 0) {
        var mapping = this._originalMappings[index];
        if (mapping.source === needle.source) {
          return {
            line: util.getArg(mapping, "generatedLine", null),
            column: util.getArg(mapping, "generatedColumn", null),
            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
          };
        }
      }
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    };
    exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
    function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
      var sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util.parseSourceMapInput(aSourceMap);
      }
      var version2 = util.getArg(sourceMap, "version");
      var sections = util.getArg(sourceMap, "sections");
      if (version2 != this._version) {
        throw new Error("Unsupported version: " + version2);
      }
      this._sources = new ArraySet();
      this._names = new ArraySet();
      var lastOffset = {
        line: -1,
        column: 0
      };
      this._sections = sections.map(function(s) {
        if (s.url) {
          throw new Error("Support for url field in sections not implemented.");
        }
        var offset2 = util.getArg(s, "offset");
        var offsetLine = util.getArg(offset2, "line");
        var offsetColumn = util.getArg(offset2, "column");
        if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
          throw new Error("Section offsets must be ordered and non-overlapping.");
        }
        lastOffset = offset2;
        return {
          generatedOffset: {
            // The offset fields are 0-based, but we use 1-based indices when
            // encoding/decoding from VLQ.
            generatedLine: offsetLine + 1,
            generatedColumn: offsetColumn + 1
          },
          consumer: new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL)
        };
      });
    }
    IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
    IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;
    IndexedSourceMapConsumer.prototype._version = 3;
    Object.defineProperty(IndexedSourceMapConsumer.prototype, "sources", {
      get: function() {
        var sources = [];
        for (var i2 = 0; i2 < this._sections.length; i2++) {
          for (var j3 = 0; j3 < this._sections[i2].consumer.sources.length; j3++) {
            sources.push(this._sections[i2].consumer.sources[j3]);
          }
        }
        return sources;
      }
    });
    IndexedSourceMapConsumer.prototype.originalPositionFor = function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, "line"),
        generatedColumn: util.getArg(aArgs, "column")
      };
      var sectionIndex = binarySearch.search(
        needle,
        this._sections,
        function(needle2, section2) {
          var cmp = needle2.generatedLine - section2.generatedOffset.generatedLine;
          if (cmp) {
            return cmp;
          }
          return needle2.generatedColumn - section2.generatedOffset.generatedColumn;
        }
      );
      var section = this._sections[sectionIndex];
      if (!section) {
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      }
      return section.consumer.originalPositionFor({
        line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
        column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
        bias: aArgs.bias
      });
    };
    IndexedSourceMapConsumer.prototype.hasContentsOfAllSources = function IndexedSourceMapConsumer_hasContentsOfAllSources() {
      return this._sections.every(function(s) {
        return s.consumer.hasContentsOfAllSources();
      });
    };
    IndexedSourceMapConsumer.prototype.sourceContentFor = function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      for (var i2 = 0; i2 < this._sections.length; i2++) {
        var section = this._sections[i2];
        var content = section.consumer.sourceContentFor(aSource, true);
        if (content) {
          return content;
        }
      }
      if (nullOnMissing) {
        return null;
      } else {
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
    };
    IndexedSourceMapConsumer.prototype.generatedPositionFor = function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
      for (var i2 = 0; i2 < this._sections.length; i2++) {
        var section = this._sections[i2];
        if (section.consumer._findSourceIndex(util.getArg(aArgs, "source")) === -1) {
          continue;
        }
        var generatedPosition = section.consumer.generatedPositionFor(aArgs);
        if (generatedPosition) {
          var ret = {
            line: generatedPosition.line + (section.generatedOffset.generatedLine - 1),
            column: generatedPosition.column + (section.generatedOffset.generatedLine === generatedPosition.line ? section.generatedOffset.generatedColumn - 1 : 0)
          };
          return ret;
        }
      }
      return {
        line: null,
        column: null
      };
    };
    IndexedSourceMapConsumer.prototype._parseMappings = function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      this.__generatedMappings = [];
      this.__originalMappings = [];
      for (var i2 = 0; i2 < this._sections.length; i2++) {
        var section = this._sections[i2];
        var sectionMappings = section.consumer._generatedMappings;
        for (var j3 = 0; j3 < sectionMappings.length; j3++) {
          var mapping = sectionMappings[j3];
          var source = section.consumer._sources.at(mapping.source);
          source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
          this._sources.add(source);
          source = this._sources.indexOf(source);
          var name = null;
          if (mapping.name) {
            name = section.consumer._names.at(mapping.name);
            this._names.add(name);
            name = this._names.indexOf(name);
          }
          var adjustedMapping = {
            source,
            generatedLine: mapping.generatedLine + (section.generatedOffset.generatedLine - 1),
            generatedColumn: mapping.generatedColumn + (section.generatedOffset.generatedLine === mapping.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
            originalLine: mapping.originalLine,
            originalColumn: mapping.originalColumn,
            name
          };
          this.__generatedMappings.push(adjustedMapping);
          if (typeof adjustedMapping.originalLine === "number") {
            this.__originalMappings.push(adjustedMapping);
          }
        }
      }
      quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
      quickSort(this.__originalMappings, util.compareByOriginalPositions);
    };
    exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
  }
});

// node_modules/source-map/lib/source-node.js
var require_source_node = __commonJS({
  "node_modules/source-map/lib/source-node.js"(exports) {
    var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
    var util = require_util();
    var REGEX_NEWLINE = /(\r?\n)/;
    var NEWLINE_CODE = 10;
    var isSourceNode = "$$$isSourceNode$$$";
    function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
      this.children = [];
      this.sourceContents = {};
      this.line = aLine == null ? null : aLine;
      this.column = aColumn == null ? null : aColumn;
      this.source = aSource == null ? null : aSource;
      this.name = aName == null ? null : aName;
      this[isSourceNode] = true;
      if (aChunks != null) this.add(aChunks);
    }
    SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
      var node = new SourceNode();
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var remainingLinesIndex = 0;
      var shiftNextLine = function() {
        var lineContents = getNextLine();
        var newLine = getNextLine() || "";
        return lineContents + newLine;
        function getNextLine() {
          return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : void 0;
        }
      };
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;
      var lastMapping = null;
      aSourceMapConsumer.eachMapping(function(mapping) {
        if (lastMapping !== null) {
          if (lastGeneratedLine < mapping.generatedLine) {
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
          } else {
            var nextLine = remainingLines[remainingLinesIndex] || "";
            var code2 = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
            remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code2);
            lastMapping = mapping;
            return;
          }
        }
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[remainingLinesIndex] || "";
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      if (remainingLinesIndex < remainingLines.length) {
        if (lastMapping) {
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        node.add(remainingLines.splice(remainingLinesIndex).join(""));
      }
      aSourceMapConsumer.sources.forEach(function(sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aRelativePath != null) {
            sourceFile = util.join(aRelativePath, sourceFile);
          }
          node.setSourceContent(sourceFile, content);
        }
      });
      return node;
      function addMappingWithCode(mapping, code2) {
        if (mapping === null || mapping.source === void 0) {
          node.add(code2);
        } else {
          var source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
          node.add(new SourceNode(
            mapping.originalLine,
            mapping.originalColumn,
            source,
            code2,
            mapping.name
          ));
        }
      }
    };
    SourceNode.prototype.add = function SourceNode_add(aChunk) {
      if (Array.isArray(aChunk)) {
        aChunk.forEach(function(chunk) {
          this.add(chunk);
        }, this);
      } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
        if (aChunk) {
          this.children.push(aChunk);
        }
      } else {
        throw new TypeError(
          "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
        );
      }
      return this;
    };
    SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
      if (Array.isArray(aChunk)) {
        for (var i2 = aChunk.length - 1; i2 >= 0; i2--) {
          this.prepend(aChunk[i2]);
        }
      } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
        this.children.unshift(aChunk);
      } else {
        throw new TypeError(
          "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
        );
      }
      return this;
    };
    SourceNode.prototype.walk = function SourceNode_walk(aFn) {
      var chunk;
      for (var i2 = 0, len = this.children.length; i2 < len; i2++) {
        chunk = this.children[i2];
        if (chunk[isSourceNode]) {
          chunk.walk(aFn);
        } else {
          if (chunk !== "") {
            aFn(chunk, {
              source: this.source,
              line: this.line,
              column: this.column,
              name: this.name
            });
          }
        }
      }
    };
    SourceNode.prototype.join = function SourceNode_join(aSep) {
      var newChildren;
      var i2;
      var len = this.children.length;
      if (len > 0) {
        newChildren = [];
        for (i2 = 0; i2 < len - 1; i2++) {
          newChildren.push(this.children[i2]);
          newChildren.push(aSep);
        }
        newChildren.push(this.children[i2]);
        this.children = newChildren;
      }
      return this;
    };
    SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
      var lastChild = this.children[this.children.length - 1];
      if (lastChild[isSourceNode]) {
        lastChild.replaceRight(aPattern, aReplacement);
      } else if (typeof lastChild === "string") {
        this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
      } else {
        this.children.push("".replace(aPattern, aReplacement));
      }
      return this;
    };
    SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };
    SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
      for (var i2 = 0, len = this.children.length; i2 < len; i2++) {
        if (this.children[i2][isSourceNode]) {
          this.children[i2].walkSourceContents(aFn);
        }
      }
      var sources = Object.keys(this.sourceContents);
      for (var i2 = 0, len = sources.length; i2 < len; i2++) {
        aFn(util.fromSetString(sources[i2]), this.sourceContents[sources[i2]]);
      }
    };
    SourceNode.prototype.toString = function SourceNode_toString() {
      var str = "";
      this.walk(function(chunk) {
        str += chunk;
      });
      return str;
    };
    SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
      var generated = {
        code: "",
        line: 1,
        column: 0
      };
      var map = new SourceMapGenerator(aArgs);
      var sourceMappingActive = false;
      var lastOriginalSource = null;
      var lastOriginalLine = null;
      var lastOriginalColumn = null;
      var lastOriginalName = null;
      this.walk(function(chunk, original) {
        generated.code += chunk;
        if (original.source !== null && original.line !== null && original.column !== null) {
          if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
          lastOriginalSource = original.source;
          lastOriginalLine = original.line;
          lastOriginalColumn = original.column;
          lastOriginalName = original.name;
          sourceMappingActive = true;
        } else if (sourceMappingActive) {
          map.addMapping({
            generated: {
              line: generated.line,
              column: generated.column
            }
          });
          lastOriginalSource = null;
          sourceMappingActive = false;
        }
        for (var idx = 0, length = chunk.length; idx < length; idx++) {
          if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
            generated.line++;
            generated.column = 0;
            if (idx + 1 === length) {
              lastOriginalSource = null;
              sourceMappingActive = false;
            } else if (sourceMappingActive) {
              map.addMapping({
                source: original.source,
                original: {
                  line: original.line,
                  column: original.column
                },
                generated: {
                  line: generated.line,
                  column: generated.column
                },
                name: original.name
              });
            }
          } else {
            generated.column++;
          }
        }
      });
      this.walkSourceContents(function(sourceFile, sourceContent) {
        map.setSourceContent(sourceFile, sourceContent);
      });
      return { code: generated.code, map };
    };
    exports.SourceNode = SourceNode;
  }
});

// node_modules/source-map/source-map.js
var require_source_map = __commonJS({
  "node_modules/source-map/source-map.js"(exports) {
    exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
    exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
    exports.SourceNode = require_source_node().SourceNode;
  }
});

// node_modules/escodegen/package.json
var require_package = __commonJS({
  "node_modules/escodegen/package.json"(exports, module) {
    module.exports = {
      name: "escodegen",
      description: "ECMAScript code generator",
      homepage: "http://github.com/estools/escodegen",
      main: "escodegen.js",
      bin: {
        esgenerate: "./bin/esgenerate.js",
        escodegen: "./bin/escodegen.js"
      },
      files: [
        "LICENSE.BSD",
        "README.md",
        "bin",
        "escodegen.js",
        "package.json"
      ],
      version: "2.1.0",
      engines: {
        node: ">=6.0"
      },
      maintainers: [
        {
          name: "Yusuke Suzuki",
          email: "utatane.tea@gmail.com",
          web: "http://github.com/Constellation"
        }
      ],
      repository: {
        type: "git",
        url: "http://github.com/estools/escodegen.git"
      },
      dependencies: {
        estraverse: "^5.2.0",
        esutils: "^2.0.2",
        esprima: "^4.0.1"
      },
      optionalDependencies: {
        "source-map": "~0.6.1"
      },
      devDependencies: {
        acorn: "^8.0.4",
        bluebird: "^3.4.7",
        "bower-registry-client": "^1.0.0",
        chai: "^4.2.0",
        "chai-exclude": "^2.0.2",
        "commonjs-everywhere": "^0.9.7",
        gulp: "^4.0.2",
        "gulp-eslint": "^6.0.0",
        "gulp-mocha": "^7.0.2",
        minimist: "^1.2.5",
        optionator: "^0.9.1",
        semver: "^7.3.4"
      },
      license: "BSD-2-Clause",
      scripts: {
        test: "gulp travis",
        "unit-test": "gulp test",
        lint: "gulp lint",
        release: "node tools/release.js",
        "build-min": "./node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js",
        build: "./node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js"
      }
    };
  }
});

// node_modules/escodegen/escodegen.js
var require_escodegen = __commonJS({
  "node_modules/escodegen/escodegen.js"(exports) {
    (function() {
      "use strict";
      var Syntax, Precedence, BinaryPrecedence, SourceNode, estraverse, esutils, base, indent, json, renumber, hexadecimal, quotes, escapeless, newline, space, parentheses, semicolons, safeConcatenation, directive, extra, parse5, sourceMap, sourceCode, preserveBlankLines, FORMAT_MINIFY, FORMAT_DEFAULTS;
      estraverse = require_estraverse();
      esutils = require_utils();
      Syntax = estraverse.Syntax;
      function isExpression(node) {
        return CodeGenerator.Expression.hasOwnProperty(node.type);
      }
      function isStatement(node) {
        return CodeGenerator.Statement.hasOwnProperty(node.type);
      }
      Precedence = {
        Sequence: 0,
        Yield: 1,
        Assignment: 1,
        Conditional: 2,
        ArrowFunction: 2,
        Coalesce: 3,
        LogicalOR: 4,
        LogicalAND: 5,
        BitwiseOR: 6,
        BitwiseXOR: 7,
        BitwiseAND: 8,
        Equality: 9,
        Relational: 10,
        BitwiseSHIFT: 11,
        Additive: 12,
        Multiplicative: 13,
        Exponentiation: 14,
        Await: 15,
        Unary: 15,
        Postfix: 16,
        OptionalChaining: 17,
        Call: 18,
        New: 19,
        TaggedTemplate: 20,
        Member: 21,
        Primary: 22
      };
      BinaryPrecedence = {
        "??": Precedence.Coalesce,
        "||": Precedence.LogicalOR,
        "&&": Precedence.LogicalAND,
        "|": Precedence.BitwiseOR,
        "^": Precedence.BitwiseXOR,
        "&": Precedence.BitwiseAND,
        "==": Precedence.Equality,
        "!=": Precedence.Equality,
        "===": Precedence.Equality,
        "!==": Precedence.Equality,
        "is": Precedence.Equality,
        "isnt": Precedence.Equality,
        "<": Precedence.Relational,
        ">": Precedence.Relational,
        "<=": Precedence.Relational,
        ">=": Precedence.Relational,
        "in": Precedence.Relational,
        "instanceof": Precedence.Relational,
        "<<": Precedence.BitwiseSHIFT,
        ">>": Precedence.BitwiseSHIFT,
        ">>>": Precedence.BitwiseSHIFT,
        "+": Precedence.Additive,
        "-": Precedence.Additive,
        "*": Precedence.Multiplicative,
        "%": Precedence.Multiplicative,
        "/": Precedence.Multiplicative,
        "**": Precedence.Exponentiation
      };
      var F_ALLOW_IN = 1, F_ALLOW_CALL = 1 << 1, F_ALLOW_UNPARATH_NEW = 1 << 2, F_FUNC_BODY = 1 << 3, F_DIRECTIVE_CTX = 1 << 4, F_SEMICOLON_OPT = 1 << 5, F_FOUND_COALESCE = 1 << 6;
      var E_FTT = F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW, E_TTF = F_ALLOW_IN | F_ALLOW_CALL, E_TTT = F_ALLOW_IN | F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW, E_TFF = F_ALLOW_IN, E_FFT = F_ALLOW_UNPARATH_NEW, E_TFT = F_ALLOW_IN | F_ALLOW_UNPARATH_NEW;
      var S_TFFF = F_ALLOW_IN, S_TFFT = F_ALLOW_IN | F_SEMICOLON_OPT, S_FFFF = 0, S_TFTF = F_ALLOW_IN | F_DIRECTIVE_CTX, S_TTFF = F_ALLOW_IN | F_FUNC_BODY;
      function getDefaultOptions() {
        return {
          indent: null,
          base: null,
          parse: null,
          comment: false,
          format: {
            indent: {
              style: "    ",
              base: 0,
              adjustMultilineComment: false
            },
            newline: "\n",
            space: " ",
            json: false,
            renumber: false,
            hexadecimal: false,
            quotes: "single",
            escapeless: false,
            compact: false,
            parentheses: true,
            semicolons: true,
            safeConcatenation: false,
            preserveBlankLines: false
          },
          moz: {
            comprehensionExpressionStartsWithAssignment: false,
            starlessGenerator: false
          },
          sourceMap: null,
          sourceMapRoot: null,
          sourceMapWithCode: false,
          directive: false,
          raw: true,
          verbatim: null,
          sourceCode: null
        };
      }
      function stringRepeat(str, num) {
        var result = "";
        for (num |= 0; num > 0; num >>>= 1, str += str) {
          if (num & 1) {
            result += str;
          }
        }
        return result;
      }
      function hasLineTerminator(str) {
        return /[\r\n]/g.test(str);
      }
      function endsWithLineTerminator(str) {
        var len = str.length;
        return len && esutils.code.isLineTerminator(str.charCodeAt(len - 1));
      }
      function merge(target, override) {
        var key;
        for (key in override) {
          if (override.hasOwnProperty(key)) {
            target[key] = override[key];
          }
        }
        return target;
      }
      function updateDeeply(target, override) {
        var key, val;
        function isHashObject(target2) {
          return typeof target2 === "object" && target2 instanceof Object && !(target2 instanceof RegExp);
        }
        for (key in override) {
          if (override.hasOwnProperty(key)) {
            val = override[key];
            if (isHashObject(val)) {
              if (isHashObject(target[key])) {
                updateDeeply(target[key], val);
              } else {
                target[key] = updateDeeply({}, val);
              }
            } else {
              target[key] = val;
            }
          }
        }
        return target;
      }
      function generateNumber(value) {
        var result, point, temp, exponent, pos;
        if (value !== value) {
          throw new Error("Numeric literal whose value is NaN");
        }
        if (value < 0 || value === 0 && 1 / value < 0) {
          throw new Error("Numeric literal whose value is negative");
        }
        if (value === 1 / 0) {
          return json ? "null" : renumber ? "1e400" : "1e+400";
        }
        result = "" + value;
        if (!renumber || result.length < 3) {
          return result;
        }
        point = result.indexOf(".");
        if (!json && result.charCodeAt(0) === 48 && point === 1) {
          point = 0;
          result = result.slice(1);
        }
        temp = result;
        result = result.replace("e+", "e");
        exponent = 0;
        if ((pos = temp.indexOf("e")) > 0) {
          exponent = +temp.slice(pos + 1);
          temp = temp.slice(0, pos);
        }
        if (point >= 0) {
          exponent -= temp.length - point - 1;
          temp = +(temp.slice(0, point) + temp.slice(point + 1)) + "";
        }
        pos = 0;
        while (temp.charCodeAt(temp.length + pos - 1) === 48) {
          --pos;
        }
        if (pos !== 0) {
          exponent -= pos;
          temp = temp.slice(0, pos);
        }
        if (exponent !== 0) {
          temp += "e" + exponent;
        }
        if ((temp.length < result.length || hexadecimal && value > 1e12 && Math.floor(value) === value && (temp = "0x" + value.toString(16)).length < result.length) && +temp === value) {
          result = temp;
        }
        return result;
      }
      function escapeRegExpCharacter(ch2, previousIsBackslash) {
        if ((ch2 & ~1) === 8232) {
          return (previousIsBackslash ? "u" : "\\u") + (ch2 === 8232 ? "2028" : "2029");
        } else if (ch2 === 10 || ch2 === 13) {
          return (previousIsBackslash ? "" : "\\") + (ch2 === 10 ? "n" : "r");
        }
        return String.fromCharCode(ch2);
      }
      function generateRegExp(reg) {
        var match, result, flags, i2, iz, ch2, characterInBrack, previousIsBackslash;
        result = reg.toString();
        if (reg.source) {
          match = result.match(/\/([^/]*)$/);
          if (!match) {
            return result;
          }
          flags = match[1];
          result = "";
          characterInBrack = false;
          previousIsBackslash = false;
          for (i2 = 0, iz = reg.source.length; i2 < iz; ++i2) {
            ch2 = reg.source.charCodeAt(i2);
            if (!previousIsBackslash) {
              if (characterInBrack) {
                if (ch2 === 93) {
                  characterInBrack = false;
                }
              } else {
                if (ch2 === 47) {
                  result += "\\";
                } else if (ch2 === 91) {
                  characterInBrack = true;
                }
              }
              result += escapeRegExpCharacter(ch2, previousIsBackslash);
              previousIsBackslash = ch2 === 92;
            } else {
              result += escapeRegExpCharacter(ch2, previousIsBackslash);
              previousIsBackslash = false;
            }
          }
          return "/" + result + "/" + flags;
        }
        return result;
      }
      function escapeAllowedCharacter(code2, next) {
        var hex;
        if (code2 === 8) {
          return "\\b";
        }
        if (code2 === 12) {
          return "\\f";
        }
        if (code2 === 9) {
          return "\\t";
        }
        hex = code2.toString(16).toUpperCase();
        if (json || code2 > 255) {
          return "\\u" + "0000".slice(hex.length) + hex;
        } else if (code2 === 0 && !esutils.code.isDecimalDigit(next)) {
          return "\\0";
        } else if (code2 === 11) {
          return "\\x0B";
        } else {
          return "\\x" + "00".slice(hex.length) + hex;
        }
      }
      function escapeDisallowedCharacter(code2) {
        if (code2 === 92) {
          return "\\\\";
        }
        if (code2 === 10) {
          return "\\n";
        }
        if (code2 === 13) {
          return "\\r";
        }
        if (code2 === 8232) {
          return "\\u2028";
        }
        if (code2 === 8233) {
          return "\\u2029";
        }
        throw new Error("Incorrectly classified character");
      }
      function escapeDirective(str) {
        var i2, iz, code2, quote;
        quote = quotes === "double" ? '"' : "'";
        for (i2 = 0, iz = str.length; i2 < iz; ++i2) {
          code2 = str.charCodeAt(i2);
          if (code2 === 39) {
            quote = '"';
            break;
          } else if (code2 === 34) {
            quote = "'";
            break;
          } else if (code2 === 92) {
            ++i2;
          }
        }
        return quote + str + quote;
      }
      function escapeString(str) {
        var result = "", i2, len, code2, singleQuotes = 0, doubleQuotes = 0, single, quote;
        for (i2 = 0, len = str.length; i2 < len; ++i2) {
          code2 = str.charCodeAt(i2);
          if (code2 === 39) {
            ++singleQuotes;
          } else if (code2 === 34) {
            ++doubleQuotes;
          } else if (code2 === 47 && json) {
            result += "\\";
          } else if (esutils.code.isLineTerminator(code2) || code2 === 92) {
            result += escapeDisallowedCharacter(code2);
            continue;
          } else if (!esutils.code.isIdentifierPartES5(code2) && (json && code2 < 32 || !json && !escapeless && (code2 < 32 || code2 > 126))) {
            result += escapeAllowedCharacter(code2, str.charCodeAt(i2 + 1));
            continue;
          }
          result += String.fromCharCode(code2);
        }
        single = !(quotes === "double" || quotes === "auto" && doubleQuotes < singleQuotes);
        quote = single ? "'" : '"';
        if (!(single ? singleQuotes : doubleQuotes)) {
          return quote + result + quote;
        }
        str = result;
        result = quote;
        for (i2 = 0, len = str.length; i2 < len; ++i2) {
          code2 = str.charCodeAt(i2);
          if (code2 === 39 && single || code2 === 34 && !single) {
            result += "\\";
          }
          result += String.fromCharCode(code2);
        }
        return result + quote;
      }
      function flattenToString(arr) {
        var i2, iz, elem, result = "";
        for (i2 = 0, iz = arr.length; i2 < iz; ++i2) {
          elem = arr[i2];
          result += Array.isArray(elem) ? flattenToString(elem) : elem;
        }
        return result;
      }
      function toSourceNodeWhenNeeded(generated, node) {
        if (!sourceMap) {
          if (Array.isArray(generated)) {
            return flattenToString(generated);
          } else {
            return generated;
          }
        }
        if (node == null) {
          if (generated instanceof SourceNode) {
            return generated;
          } else {
            node = {};
          }
        }
        if (node.loc == null) {
          return new SourceNode(null, null, sourceMap, generated, node.name || null);
        }
        return new SourceNode(node.loc.start.line, node.loc.start.column, sourceMap === true ? node.loc.source || null : sourceMap, generated, node.name || null);
      }
      function noEmptySpace() {
        return space ? space : " ";
      }
      function join(left, right) {
        var leftSource, rightSource, leftCharCode, rightCharCode;
        leftSource = toSourceNodeWhenNeeded(left).toString();
        if (leftSource.length === 0) {
          return [right];
        }
        rightSource = toSourceNodeWhenNeeded(right).toString();
        if (rightSource.length === 0) {
          return [left];
        }
        leftCharCode = leftSource.charCodeAt(leftSource.length - 1);
        rightCharCode = rightSource.charCodeAt(0);
        if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPartES5(leftCharCode) && esutils.code.isIdentifierPartES5(rightCharCode) || leftCharCode === 47 && rightCharCode === 105) {
          return [left, noEmptySpace(), right];
        } else if (esutils.code.isWhiteSpace(leftCharCode) || esutils.code.isLineTerminator(leftCharCode) || esutils.code.isWhiteSpace(rightCharCode) || esutils.code.isLineTerminator(rightCharCode)) {
          return [left, right];
        }
        return [left, space, right];
      }
      function addIndent(stmt) {
        return [base, stmt];
      }
      function withIndent(fn2) {
        var previousBase;
        previousBase = base;
        base += indent;
        fn2(base);
        base = previousBase;
      }
      function calculateSpaces(str) {
        var i2;
        for (i2 = str.length - 1; i2 >= 0; --i2) {
          if (esutils.code.isLineTerminator(str.charCodeAt(i2))) {
            break;
          }
        }
        return str.length - 1 - i2;
      }
      function adjustMultilineComment(value, specialBase) {
        var array, i2, len, line, j3, spaces, previousBase, sn2;
        array = value.split(/\r\n|[\r\n]/);
        spaces = Number.MAX_VALUE;
        for (i2 = 1, len = array.length; i2 < len; ++i2) {
          line = array[i2];
          j3 = 0;
          while (j3 < line.length && esutils.code.isWhiteSpace(line.charCodeAt(j3))) {
            ++j3;
          }
          if (spaces > j3) {
            spaces = j3;
          }
        }
        if (typeof specialBase !== "undefined") {
          previousBase = base;
          if (array[1][spaces] === "*") {
            specialBase += " ";
          }
          base = specialBase;
        } else {
          if (spaces & 1) {
            --spaces;
          }
          previousBase = base;
        }
        for (i2 = 1, len = array.length; i2 < len; ++i2) {
          sn2 = toSourceNodeWhenNeeded(addIndent(array[i2].slice(spaces)));
          array[i2] = sourceMap ? sn2.join("") : sn2;
        }
        base = previousBase;
        return array.join("\n");
      }
      function generateComment(comment, specialBase) {
        if (comment.type === "Line") {
          if (endsWithLineTerminator(comment.value)) {
            return "//" + comment.value;
          } else {
            var result = "//" + comment.value;
            if (!preserveBlankLines) {
              result += "\n";
            }
            return result;
          }
        }
        if (extra.format.indent.adjustMultilineComment && /[\n\r]/.test(comment.value)) {
          return adjustMultilineComment("/*" + comment.value + "*/", specialBase);
        }
        return "/*" + comment.value + "*/";
      }
      function addComments(stmt, result) {
        var i2, len, comment, save, tailingToStatement, specialBase, fragment, extRange, range, prevRange, prefix, infix, suffix, count;
        if (stmt.leadingComments && stmt.leadingComments.length > 0) {
          save = result;
          if (preserveBlankLines) {
            comment = stmt.leadingComments[0];
            result = [];
            extRange = comment.extendedRange;
            range = comment.range;
            prefix = sourceCode.substring(extRange[0], range[0]);
            count = (prefix.match(/\n/g) || []).length;
            if (count > 0) {
              result.push(stringRepeat("\n", count));
              result.push(addIndent(generateComment(comment)));
            } else {
              result.push(prefix);
              result.push(generateComment(comment));
            }
            prevRange = range;
            for (i2 = 1, len = stmt.leadingComments.length; i2 < len; i2++) {
              comment = stmt.leadingComments[i2];
              range = comment.range;
              infix = sourceCode.substring(prevRange[1], range[0]);
              count = (infix.match(/\n/g) || []).length;
              result.push(stringRepeat("\n", count));
              result.push(addIndent(generateComment(comment)));
              prevRange = range;
            }
            suffix = sourceCode.substring(range[1], extRange[1]);
            count = (suffix.match(/\n/g) || []).length;
            result.push(stringRepeat("\n", count));
          } else {
            comment = stmt.leadingComments[0];
            result = [];
            if (safeConcatenation && stmt.type === Syntax.Program && stmt.body.length === 0) {
              result.push("\n");
            }
            result.push(generateComment(comment));
            if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result.push("\n");
            }
            for (i2 = 1, len = stmt.leadingComments.length; i2 < len; ++i2) {
              comment = stmt.leadingComments[i2];
              fragment = [generateComment(comment)];
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                fragment.push("\n");
              }
              result.push(addIndent(fragment));
            }
          }
          result.push(addIndent(save));
        }
        if (stmt.trailingComments) {
          if (preserveBlankLines) {
            comment = stmt.trailingComments[0];
            extRange = comment.extendedRange;
            range = comment.range;
            prefix = sourceCode.substring(extRange[0], range[0]);
            count = (prefix.match(/\n/g) || []).length;
            if (count > 0) {
              result.push(stringRepeat("\n", count));
              result.push(addIndent(generateComment(comment)));
            } else {
              result.push(prefix);
              result.push(generateComment(comment));
            }
          } else {
            tailingToStatement = !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
            specialBase = stringRepeat(" ", calculateSpaces(toSourceNodeWhenNeeded([base, result, indent]).toString()));
            for (i2 = 0, len = stmt.trailingComments.length; i2 < len; ++i2) {
              comment = stmt.trailingComments[i2];
              if (tailingToStatement) {
                if (i2 === 0) {
                  result = [result, indent];
                } else {
                  result = [result, specialBase];
                }
                result.push(generateComment(comment, specialBase));
              } else {
                result = [result, addIndent(generateComment(comment))];
              }
              if (i2 !== len - 1 && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                result = [result, "\n"];
              }
            }
          }
        }
        return result;
      }
      function generateBlankLines(start, end, result) {
        var j3, newlineCount = 0;
        for (j3 = start; j3 < end; j3++) {
          if (sourceCode[j3] === "\n") {
            newlineCount++;
          }
        }
        for (j3 = 1; j3 < newlineCount; j3++) {
          result.push(newline);
        }
      }
      function parenthesize(text, current2, should) {
        if (current2 < should) {
          return ["(", text, ")"];
        }
        return text;
      }
      function generateVerbatimString(string) {
        var i2, iz, result;
        result = string.split(/\r\n|\n/);
        for (i2 = 1, iz = result.length; i2 < iz; i2++) {
          result[i2] = newline + base + result[i2];
        }
        return result;
      }
      function generateVerbatim(expr, precedence) {
        var verbatim, result, prec;
        verbatim = expr[extra.verbatim];
        if (typeof verbatim === "string") {
          result = parenthesize(generateVerbatimString(verbatim), Precedence.Sequence, precedence);
        } else {
          result = generateVerbatimString(verbatim.content);
          prec = verbatim.precedence != null ? verbatim.precedence : Precedence.Sequence;
          result = parenthesize(result, prec, precedence);
        }
        return toSourceNodeWhenNeeded(result, expr);
      }
      function CodeGenerator() {
      }
      CodeGenerator.prototype.maybeBlock = function(stmt, flags) {
        var result, noLeadingComment, that = this;
        noLeadingComment = !extra.comment || !stmt.leadingComments;
        if (stmt.type === Syntax.BlockStatement && noLeadingComment) {
          return [space, this.generateStatement(stmt, flags)];
        }
        if (stmt.type === Syntax.EmptyStatement && noLeadingComment) {
          return ";";
        }
        withIndent(function() {
          result = [
            newline,
            addIndent(that.generateStatement(stmt, flags))
          ];
        });
        return result;
      };
      CodeGenerator.prototype.maybeBlockSuffix = function(stmt, result) {
        var ends = endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
        if (stmt.type === Syntax.BlockStatement && (!extra.comment || !stmt.leadingComments) && !ends) {
          return [result, space];
        }
        if (ends) {
          return [result, base];
        }
        return [result, newline, base];
      };
      function generateIdentifier(node) {
        return toSourceNodeWhenNeeded(node.name, node);
      }
      function generateAsyncPrefix(node, spaceRequired) {
        return node.async ? "async" + (spaceRequired ? noEmptySpace() : space) : "";
      }
      function generateStarSuffix(node) {
        var isGenerator = node.generator && !extra.moz.starlessGenerator;
        return isGenerator ? "*" + space : "";
      }
      function generateMethodPrefix(prop) {
        var func = prop.value, prefix = "";
        if (func.async) {
          prefix += generateAsyncPrefix(func, !prop.computed);
        }
        if (func.generator) {
          prefix += generateStarSuffix(func) ? "*" : "";
        }
        return prefix;
      }
      CodeGenerator.prototype.generatePattern = function(node, precedence, flags) {
        if (node.type === Syntax.Identifier) {
          return generateIdentifier(node);
        }
        return this.generateExpression(node, precedence, flags);
      };
      CodeGenerator.prototype.generateFunctionParams = function(node) {
        var i2, iz, result, hasDefault;
        hasDefault = false;
        if (node.type === Syntax.ArrowFunctionExpression && !node.rest && (!node.defaults || node.defaults.length === 0) && node.params.length === 1 && node.params[0].type === Syntax.Identifier) {
          result = [generateAsyncPrefix(node, true), generateIdentifier(node.params[0])];
        } else {
          result = node.type === Syntax.ArrowFunctionExpression ? [generateAsyncPrefix(node, false)] : [];
          result.push("(");
          if (node.defaults) {
            hasDefault = true;
          }
          for (i2 = 0, iz = node.params.length; i2 < iz; ++i2) {
            if (hasDefault && node.defaults[i2]) {
              result.push(this.generateAssignment(node.params[i2], node.defaults[i2], "=", Precedence.Assignment, E_TTT));
            } else {
              result.push(this.generatePattern(node.params[i2], Precedence.Assignment, E_TTT));
            }
            if (i2 + 1 < iz) {
              result.push("," + space);
            }
          }
          if (node.rest) {
            if (node.params.length) {
              result.push("," + space);
            }
            result.push("...");
            result.push(generateIdentifier(node.rest));
          }
          result.push(")");
        }
        return result;
      };
      CodeGenerator.prototype.generateFunctionBody = function(node) {
        var result, expr;
        result = this.generateFunctionParams(node);
        if (node.type === Syntax.ArrowFunctionExpression) {
          result.push(space);
          result.push("=>");
        }
        if (node.expression) {
          result.push(space);
          expr = this.generateExpression(node.body, Precedence.Assignment, E_TTT);
          if (expr.toString().charAt(0) === "{") {
            expr = ["(", expr, ")"];
          }
          result.push(expr);
        } else {
          result.push(this.maybeBlock(node.body, S_TTFF));
        }
        return result;
      };
      CodeGenerator.prototype.generateIterationForStatement = function(operator, stmt, flags) {
        var result = ["for" + (stmt.await ? noEmptySpace() + "await" : "") + space + "("], that = this;
        withIndent(function() {
          if (stmt.left.type === Syntax.VariableDeclaration) {
            withIndent(function() {
              result.push(stmt.left.kind + noEmptySpace());
              result.push(that.generateStatement(stmt.left.declarations[0], S_FFFF));
            });
          } else {
            result.push(that.generateExpression(stmt.left, Precedence.Call, E_TTT));
          }
          result = join(result, operator);
          result = [join(
            result,
            that.generateExpression(stmt.right, Precedence.Assignment, E_TTT)
          ), ")"];
        });
        result.push(this.maybeBlock(stmt.body, flags));
        return result;
      };
      CodeGenerator.prototype.generatePropertyKey = function(expr, computed) {
        var result = [];
        if (computed) {
          result.push("[");
        }
        result.push(this.generateExpression(expr, Precedence.Assignment, E_TTT));
        if (computed) {
          result.push("]");
        }
        return result;
      };
      CodeGenerator.prototype.generateAssignment = function(left, right, operator, precedence, flags) {
        if (Precedence.Assignment < precedence) {
          flags |= F_ALLOW_IN;
        }
        return parenthesize(
          [
            this.generateExpression(left, Precedence.Call, flags),
            space + operator + space,
            this.generateExpression(right, Precedence.Assignment, flags)
          ],
          Precedence.Assignment,
          precedence
        );
      };
      CodeGenerator.prototype.semicolon = function(flags) {
        if (!semicolons && flags & F_SEMICOLON_OPT) {
          return "";
        }
        return ";";
      };
      CodeGenerator.Statement = {
        BlockStatement: function(stmt, flags) {
          var range, content, result = ["{", newline], that = this;
          withIndent(function() {
            if (stmt.body.length === 0 && preserveBlankLines) {
              range = stmt.range;
              if (range[1] - range[0] > 2) {
                content = sourceCode.substring(range[0] + 1, range[1] - 1);
                if (content[0] === "\n") {
                  result = ["{"];
                }
                result.push(content);
              }
            }
            var i2, iz, fragment, bodyFlags;
            bodyFlags = S_TFFF;
            if (flags & F_FUNC_BODY) {
              bodyFlags |= F_DIRECTIVE_CTX;
            }
            for (i2 = 0, iz = stmt.body.length; i2 < iz; ++i2) {
              if (preserveBlankLines) {
                if (i2 === 0) {
                  if (stmt.body[0].leadingComments) {
                    range = stmt.body[0].leadingComments[0].extendedRange;
                    content = sourceCode.substring(range[0], range[1]);
                    if (content[0] === "\n") {
                      result = ["{"];
                    }
                  }
                  if (!stmt.body[0].leadingComments) {
                    generateBlankLines(stmt.range[0], stmt.body[0].range[0], result);
                  }
                }
                if (i2 > 0) {
                  if (!stmt.body[i2 - 1].trailingComments && !stmt.body[i2].leadingComments) {
                    generateBlankLines(stmt.body[i2 - 1].range[1], stmt.body[i2].range[0], result);
                  }
                }
              }
              if (i2 === iz - 1) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              if (stmt.body[i2].leadingComments && preserveBlankLines) {
                fragment = that.generateStatement(stmt.body[i2], bodyFlags);
              } else {
                fragment = addIndent(that.generateStatement(stmt.body[i2], bodyFlags));
              }
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                if (preserveBlankLines && i2 < iz - 1) {
                  if (!stmt.body[i2 + 1].leadingComments) {
                    result.push(newline);
                  }
                } else {
                  result.push(newline);
                }
              }
              if (preserveBlankLines) {
                if (i2 === iz - 1) {
                  if (!stmt.body[i2].trailingComments) {
                    generateBlankLines(stmt.body[i2].range[1], stmt.range[1], result);
                  }
                }
              }
            }
          });
          result.push(addIndent("}"));
          return result;
        },
        BreakStatement: function(stmt, flags) {
          if (stmt.label) {
            return "break " + stmt.label.name + this.semicolon(flags);
          }
          return "break" + this.semicolon(flags);
        },
        ContinueStatement: function(stmt, flags) {
          if (stmt.label) {
            return "continue " + stmt.label.name + this.semicolon(flags);
          }
          return "continue" + this.semicolon(flags);
        },
        ClassBody: function(stmt, flags) {
          var result = ["{", newline], that = this;
          withIndent(function(indent2) {
            var i2, iz;
            for (i2 = 0, iz = stmt.body.length; i2 < iz; ++i2) {
              result.push(indent2);
              result.push(that.generateExpression(stmt.body[i2], Precedence.Sequence, E_TTT));
              if (i2 + 1 < iz) {
                result.push(newline);
              }
            }
          });
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(base);
          result.push("}");
          return result;
        },
        ClassDeclaration: function(stmt, flags) {
          var result, fragment;
          result = ["class"];
          if (stmt.id) {
            result = join(result, this.generateExpression(stmt.id, Precedence.Sequence, E_TTT));
          }
          if (stmt.superClass) {
            fragment = join("extends", this.generateExpression(stmt.superClass, Precedence.Unary, E_TTT));
            result = join(result, fragment);
          }
          result.push(space);
          result.push(this.generateStatement(stmt.body, S_TFFT));
          return result;
        },
        DirectiveStatement: function(stmt, flags) {
          if (extra.raw && stmt.raw) {
            return stmt.raw + this.semicolon(flags);
          }
          return escapeDirective(stmt.directive) + this.semicolon(flags);
        },
        DoWhileStatement: function(stmt, flags) {
          var result = join("do", this.maybeBlock(stmt.body, S_TFFF));
          result = this.maybeBlockSuffix(stmt.body, result);
          return join(result, [
            "while" + space + "(",
            this.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
            ")" + this.semicolon(flags)
          ]);
        },
        CatchClause: function(stmt, flags) {
          var result, that = this;
          withIndent(function() {
            var guard;
            if (stmt.param) {
              result = [
                "catch" + space + "(",
                that.generateExpression(stmt.param, Precedence.Sequence, E_TTT),
                ")"
              ];
              if (stmt.guard) {
                guard = that.generateExpression(stmt.guard, Precedence.Sequence, E_TTT);
                result.splice(2, 0, " if ", guard);
              }
            } else {
              result = ["catch"];
            }
          });
          result.push(this.maybeBlock(stmt.body, S_TFFF));
          return result;
        },
        DebuggerStatement: function(stmt, flags) {
          return "debugger" + this.semicolon(flags);
        },
        EmptyStatement: function(stmt, flags) {
          return ";";
        },
        ExportDefaultDeclaration: function(stmt, flags) {
          var result = ["export"], bodyFlags;
          bodyFlags = flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF;
          result = join(result, "default");
          if (isStatement(stmt.declaration)) {
            result = join(result, this.generateStatement(stmt.declaration, bodyFlags));
          } else {
            result = join(result, this.generateExpression(stmt.declaration, Precedence.Assignment, E_TTT) + this.semicolon(flags));
          }
          return result;
        },
        ExportNamedDeclaration: function(stmt, flags) {
          var result = ["export"], bodyFlags, that = this;
          bodyFlags = flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF;
          if (stmt.declaration) {
            return join(result, this.generateStatement(stmt.declaration, bodyFlags));
          }
          if (stmt.specifiers) {
            if (stmt.specifiers.length === 0) {
              result = join(result, "{" + space + "}");
            } else if (stmt.specifiers[0].type === Syntax.ExportBatchSpecifier) {
              result = join(result, this.generateExpression(stmt.specifiers[0], Precedence.Sequence, E_TTT));
            } else {
              result = join(result, "{");
              withIndent(function(indent2) {
                var i2, iz;
                result.push(newline);
                for (i2 = 0, iz = stmt.specifiers.length; i2 < iz; ++i2) {
                  result.push(indent2);
                  result.push(that.generateExpression(stmt.specifiers[i2], Precedence.Sequence, E_TTT));
                  if (i2 + 1 < iz) {
                    result.push("," + newline);
                  }
                }
              });
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                result.push(newline);
              }
              result.push(base + "}");
            }
            if (stmt.source) {
              result = join(result, [
                "from" + space,
                // ModuleSpecifier
                this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
                this.semicolon(flags)
              ]);
            } else {
              result.push(this.semicolon(flags));
            }
          }
          return result;
        },
        ExportAllDeclaration: function(stmt, flags) {
          return [
            "export" + space,
            "*" + space,
            "from" + space,
            // ModuleSpecifier
            this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
            this.semicolon(flags)
          ];
        },
        ExpressionStatement: function(stmt, flags) {
          var result, fragment;
          function isClassPrefixed(fragment2) {
            var code2;
            if (fragment2.slice(0, 5) !== "class") {
              return false;
            }
            code2 = fragment2.charCodeAt(5);
            return code2 === 123 || esutils.code.isWhiteSpace(code2) || esutils.code.isLineTerminator(code2);
          }
          function isFunctionPrefixed(fragment2) {
            var code2;
            if (fragment2.slice(0, 8) !== "function") {
              return false;
            }
            code2 = fragment2.charCodeAt(8);
            return code2 === 40 || esutils.code.isWhiteSpace(code2) || code2 === 42 || esutils.code.isLineTerminator(code2);
          }
          function isAsyncPrefixed(fragment2) {
            var code2, i2, iz;
            if (fragment2.slice(0, 5) !== "async") {
              return false;
            }
            if (!esutils.code.isWhiteSpace(fragment2.charCodeAt(5))) {
              return false;
            }
            for (i2 = 6, iz = fragment2.length; i2 < iz; ++i2) {
              if (!esutils.code.isWhiteSpace(fragment2.charCodeAt(i2))) {
                break;
              }
            }
            if (i2 === iz) {
              return false;
            }
            if (fragment2.slice(i2, i2 + 8) !== "function") {
              return false;
            }
            code2 = fragment2.charCodeAt(i2 + 8);
            return code2 === 40 || esutils.code.isWhiteSpace(code2) || code2 === 42 || esutils.code.isLineTerminator(code2);
          }
          result = [this.generateExpression(stmt.expression, Precedence.Sequence, E_TTT)];
          fragment = toSourceNodeWhenNeeded(result).toString();
          if (fragment.charCodeAt(0) === 123 || // ObjectExpression
          isClassPrefixed(fragment) || isFunctionPrefixed(fragment) || isAsyncPrefixed(fragment) || directive && flags & F_DIRECTIVE_CTX && stmt.expression.type === Syntax.Literal && typeof stmt.expression.value === "string") {
            result = ["(", result, ")" + this.semicolon(flags)];
          } else {
            result.push(this.semicolon(flags));
          }
          return result;
        },
        ImportDeclaration: function(stmt, flags) {
          var result, cursor, that = this;
          if (stmt.specifiers.length === 0) {
            return [
              "import",
              space,
              // ModuleSpecifier
              this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
              this.semicolon(flags)
            ];
          }
          result = [
            "import"
          ];
          cursor = 0;
          if (stmt.specifiers[cursor].type === Syntax.ImportDefaultSpecifier) {
            result = join(result, [
              this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT)
            ]);
            ++cursor;
          }
          if (stmt.specifiers[cursor]) {
            if (cursor !== 0) {
              result.push(",");
            }
            if (stmt.specifiers[cursor].type === Syntax.ImportNamespaceSpecifier) {
              result = join(result, [
                space,
                this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT)
              ]);
            } else {
              result.push(space + "{");
              if (stmt.specifiers.length - cursor === 1) {
                result.push(space);
                result.push(this.generateExpression(stmt.specifiers[cursor], Precedence.Sequence, E_TTT));
                result.push(space + "}" + space);
              } else {
                withIndent(function(indent2) {
                  var i2, iz;
                  result.push(newline);
                  for (i2 = cursor, iz = stmt.specifiers.length; i2 < iz; ++i2) {
                    result.push(indent2);
                    result.push(that.generateExpression(stmt.specifiers[i2], Precedence.Sequence, E_TTT));
                    if (i2 + 1 < iz) {
                      result.push("," + newline);
                    }
                  }
                });
                if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                  result.push(newline);
                }
                result.push(base + "}" + space);
              }
            }
          }
          result = join(result, [
            "from" + space,
            // ModuleSpecifier
            this.generateExpression(stmt.source, Precedence.Sequence, E_TTT),
            this.semicolon(flags)
          ]);
          return result;
        },
        VariableDeclarator: function(stmt, flags) {
          var itemFlags = flags & F_ALLOW_IN ? E_TTT : E_FTT;
          if (stmt.init) {
            return [
              this.generateExpression(stmt.id, Precedence.Assignment, itemFlags),
              space,
              "=",
              space,
              this.generateExpression(stmt.init, Precedence.Assignment, itemFlags)
            ];
          }
          return this.generatePattern(stmt.id, Precedence.Assignment, itemFlags);
        },
        VariableDeclaration: function(stmt, flags) {
          var result, i2, iz, node, bodyFlags, that = this;
          result = [stmt.kind];
          bodyFlags = flags & F_ALLOW_IN ? S_TFFF : S_FFFF;
          function block() {
            node = stmt.declarations[0];
            if (extra.comment && node.leadingComments) {
              result.push("\n");
              result.push(addIndent(that.generateStatement(node, bodyFlags)));
            } else {
              result.push(noEmptySpace());
              result.push(that.generateStatement(node, bodyFlags));
            }
            for (i2 = 1, iz = stmt.declarations.length; i2 < iz; ++i2) {
              node = stmt.declarations[i2];
              if (extra.comment && node.leadingComments) {
                result.push("," + newline);
                result.push(addIndent(that.generateStatement(node, bodyFlags)));
              } else {
                result.push("," + space);
                result.push(that.generateStatement(node, bodyFlags));
              }
            }
          }
          if (stmt.declarations.length > 1) {
            withIndent(block);
          } else {
            block();
          }
          result.push(this.semicolon(flags));
          return result;
        },
        ThrowStatement: function(stmt, flags) {
          return [join(
            "throw",
            this.generateExpression(stmt.argument, Precedence.Sequence, E_TTT)
          ), this.semicolon(flags)];
        },
        TryStatement: function(stmt, flags) {
          var result, i2, iz, guardedHandlers;
          result = ["try", this.maybeBlock(stmt.block, S_TFFF)];
          result = this.maybeBlockSuffix(stmt.block, result);
          if (stmt.handlers) {
            for (i2 = 0, iz = stmt.handlers.length; i2 < iz; ++i2) {
              result = join(result, this.generateStatement(stmt.handlers[i2], S_TFFF));
              if (stmt.finalizer || i2 + 1 !== iz) {
                result = this.maybeBlockSuffix(stmt.handlers[i2].body, result);
              }
            }
          } else {
            guardedHandlers = stmt.guardedHandlers || [];
            for (i2 = 0, iz = guardedHandlers.length; i2 < iz; ++i2) {
              result = join(result, this.generateStatement(guardedHandlers[i2], S_TFFF));
              if (stmt.finalizer || i2 + 1 !== iz) {
                result = this.maybeBlockSuffix(guardedHandlers[i2].body, result);
              }
            }
            if (stmt.handler) {
              if (Array.isArray(stmt.handler)) {
                for (i2 = 0, iz = stmt.handler.length; i2 < iz; ++i2) {
                  result = join(result, this.generateStatement(stmt.handler[i2], S_TFFF));
                  if (stmt.finalizer || i2 + 1 !== iz) {
                    result = this.maybeBlockSuffix(stmt.handler[i2].body, result);
                  }
                }
              } else {
                result = join(result, this.generateStatement(stmt.handler, S_TFFF));
                if (stmt.finalizer) {
                  result = this.maybeBlockSuffix(stmt.handler.body, result);
                }
              }
            }
          }
          if (stmt.finalizer) {
            result = join(result, ["finally", this.maybeBlock(stmt.finalizer, S_TFFF)]);
          }
          return result;
        },
        SwitchStatement: function(stmt, flags) {
          var result, fragment, i2, iz, bodyFlags, that = this;
          withIndent(function() {
            result = [
              "switch" + space + "(",
              that.generateExpression(stmt.discriminant, Precedence.Sequence, E_TTT),
              ")" + space + "{" + newline
            ];
          });
          if (stmt.cases) {
            bodyFlags = S_TFFF;
            for (i2 = 0, iz = stmt.cases.length; i2 < iz; ++i2) {
              if (i2 === iz - 1) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              fragment = addIndent(this.generateStatement(stmt.cases[i2], bodyFlags));
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          }
          result.push(addIndent("}"));
          return result;
        },
        SwitchCase: function(stmt, flags) {
          var result, fragment, i2, iz, bodyFlags, that = this;
          withIndent(function() {
            if (stmt.test) {
              result = [
                join("case", that.generateExpression(stmt.test, Precedence.Sequence, E_TTT)),
                ":"
              ];
            } else {
              result = ["default:"];
            }
            i2 = 0;
            iz = stmt.consequent.length;
            if (iz && stmt.consequent[0].type === Syntax.BlockStatement) {
              fragment = that.maybeBlock(stmt.consequent[0], S_TFFF);
              result.push(fragment);
              i2 = 1;
            }
            if (i2 !== iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result.push(newline);
            }
            bodyFlags = S_TFFF;
            for (; i2 < iz; ++i2) {
              if (i2 === iz - 1 && flags & F_SEMICOLON_OPT) {
                bodyFlags |= F_SEMICOLON_OPT;
              }
              fragment = addIndent(that.generateStatement(stmt.consequent[i2], bodyFlags));
              result.push(fragment);
              if (i2 + 1 !== iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          });
          return result;
        },
        IfStatement: function(stmt, flags) {
          var result, bodyFlags, semicolonOptional, that = this;
          withIndent(function() {
            result = [
              "if" + space + "(",
              that.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
              ")"
            ];
          });
          semicolonOptional = flags & F_SEMICOLON_OPT;
          bodyFlags = S_TFFF;
          if (semicolonOptional) {
            bodyFlags |= F_SEMICOLON_OPT;
          }
          if (stmt.alternate) {
            result.push(this.maybeBlock(stmt.consequent, S_TFFF));
            result = this.maybeBlockSuffix(stmt.consequent, result);
            if (stmt.alternate.type === Syntax.IfStatement) {
              result = join(result, ["else ", this.generateStatement(stmt.alternate, bodyFlags)]);
            } else {
              result = join(result, join("else", this.maybeBlock(stmt.alternate, bodyFlags)));
            }
          } else {
            result.push(this.maybeBlock(stmt.consequent, bodyFlags));
          }
          return result;
        },
        ForStatement: function(stmt, flags) {
          var result, that = this;
          withIndent(function() {
            result = ["for" + space + "("];
            if (stmt.init) {
              if (stmt.init.type === Syntax.VariableDeclaration) {
                result.push(that.generateStatement(stmt.init, S_FFFF));
              } else {
                result.push(that.generateExpression(stmt.init, Precedence.Sequence, E_FTT));
                result.push(";");
              }
            } else {
              result.push(";");
            }
            if (stmt.test) {
              result.push(space);
              result.push(that.generateExpression(stmt.test, Precedence.Sequence, E_TTT));
              result.push(";");
            } else {
              result.push(";");
            }
            if (stmt.update) {
              result.push(space);
              result.push(that.generateExpression(stmt.update, Precedence.Sequence, E_TTT));
              result.push(")");
            } else {
              result.push(")");
            }
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        },
        ForInStatement: function(stmt, flags) {
          return this.generateIterationForStatement("in", stmt, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF);
        },
        ForOfStatement: function(stmt, flags) {
          return this.generateIterationForStatement("of", stmt, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF);
        },
        LabeledStatement: function(stmt, flags) {
          return [stmt.label.name + ":", this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF)];
        },
        Program: function(stmt, flags) {
          var result, fragment, i2, iz, bodyFlags;
          iz = stmt.body.length;
          result = [safeConcatenation && iz > 0 ? "\n" : ""];
          bodyFlags = S_TFTF;
          for (i2 = 0; i2 < iz; ++i2) {
            if (!safeConcatenation && i2 === iz - 1) {
              bodyFlags |= F_SEMICOLON_OPT;
            }
            if (preserveBlankLines) {
              if (i2 === 0) {
                if (!stmt.body[0].leadingComments) {
                  generateBlankLines(stmt.range[0], stmt.body[i2].range[0], result);
                }
              }
              if (i2 > 0) {
                if (!stmt.body[i2 - 1].trailingComments && !stmt.body[i2].leadingComments) {
                  generateBlankLines(stmt.body[i2 - 1].range[1], stmt.body[i2].range[0], result);
                }
              }
            }
            fragment = addIndent(this.generateStatement(stmt.body[i2], bodyFlags));
            result.push(fragment);
            if (i2 + 1 < iz && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              if (preserveBlankLines) {
                if (!stmt.body[i2 + 1].leadingComments) {
                  result.push(newline);
                }
              } else {
                result.push(newline);
              }
            }
            if (preserveBlankLines) {
              if (i2 === iz - 1) {
                if (!stmt.body[i2].trailingComments) {
                  generateBlankLines(stmt.body[i2].range[1], stmt.range[1], result);
                }
              }
            }
          }
          return result;
        },
        FunctionDeclaration: function(stmt, flags) {
          return [
            generateAsyncPrefix(stmt, true),
            "function",
            generateStarSuffix(stmt) || noEmptySpace(),
            stmt.id ? generateIdentifier(stmt.id) : "",
            this.generateFunctionBody(stmt)
          ];
        },
        ReturnStatement: function(stmt, flags) {
          if (stmt.argument) {
            return [join(
              "return",
              this.generateExpression(stmt.argument, Precedence.Sequence, E_TTT)
            ), this.semicolon(flags)];
          }
          return ["return" + this.semicolon(flags)];
        },
        WhileStatement: function(stmt, flags) {
          var result, that = this;
          withIndent(function() {
            result = [
              "while" + space + "(",
              that.generateExpression(stmt.test, Precedence.Sequence, E_TTT),
              ")"
            ];
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        },
        WithStatement: function(stmt, flags) {
          var result, that = this;
          withIndent(function() {
            result = [
              "with" + space + "(",
              that.generateExpression(stmt.object, Precedence.Sequence, E_TTT),
              ")"
            ];
          });
          result.push(this.maybeBlock(stmt.body, flags & F_SEMICOLON_OPT ? S_TFFT : S_TFFF));
          return result;
        }
      };
      merge(CodeGenerator.prototype, CodeGenerator.Statement);
      CodeGenerator.Expression = {
        SequenceExpression: function(expr, precedence, flags) {
          var result, i2, iz;
          if (Precedence.Sequence < precedence) {
            flags |= F_ALLOW_IN;
          }
          result = [];
          for (i2 = 0, iz = expr.expressions.length; i2 < iz; ++i2) {
            result.push(this.generateExpression(expr.expressions[i2], Precedence.Assignment, flags));
            if (i2 + 1 < iz) {
              result.push("," + space);
            }
          }
          return parenthesize(result, Precedence.Sequence, precedence);
        },
        AssignmentExpression: function(expr, precedence, flags) {
          return this.generateAssignment(expr.left, expr.right, expr.operator, precedence, flags);
        },
        ArrowFunctionExpression: function(expr, precedence, flags) {
          return parenthesize(this.generateFunctionBody(expr), Precedence.ArrowFunction, precedence);
        },
        ConditionalExpression: function(expr, precedence, flags) {
          if (Precedence.Conditional < precedence) {
            flags |= F_ALLOW_IN;
          }
          return parenthesize(
            [
              this.generateExpression(expr.test, Precedence.Coalesce, flags),
              space + "?" + space,
              this.generateExpression(expr.consequent, Precedence.Assignment, flags),
              space + ":" + space,
              this.generateExpression(expr.alternate, Precedence.Assignment, flags)
            ],
            Precedence.Conditional,
            precedence
          );
        },
        LogicalExpression: function(expr, precedence, flags) {
          if (expr.operator === "??") {
            flags |= F_FOUND_COALESCE;
          }
          return this.BinaryExpression(expr, precedence, flags);
        },
        BinaryExpression: function(expr, precedence, flags) {
          var result, leftPrecedence, rightPrecedence, currentPrecedence, fragment, leftSource;
          currentPrecedence = BinaryPrecedence[expr.operator];
          leftPrecedence = expr.operator === "**" ? Precedence.Postfix : currentPrecedence;
          rightPrecedence = expr.operator === "**" ? currentPrecedence : currentPrecedence + 1;
          if (currentPrecedence < precedence) {
            flags |= F_ALLOW_IN;
          }
          fragment = this.generateExpression(expr.left, leftPrecedence, flags);
          leftSource = fragment.toString();
          if (leftSource.charCodeAt(leftSource.length - 1) === 47 && esutils.code.isIdentifierPartES5(expr.operator.charCodeAt(0))) {
            result = [fragment, noEmptySpace(), expr.operator];
          } else {
            result = join(fragment, expr.operator);
          }
          fragment = this.generateExpression(expr.right, rightPrecedence, flags);
          if (expr.operator === "/" && fragment.toString().charAt(0) === "/" || expr.operator.slice(-1) === "<" && fragment.toString().slice(0, 3) === "!--") {
            result.push(noEmptySpace());
            result.push(fragment);
          } else {
            result = join(result, fragment);
          }
          if (expr.operator === "in" && !(flags & F_ALLOW_IN)) {
            return ["(", result, ")"];
          }
          if ((expr.operator === "||" || expr.operator === "&&") && flags & F_FOUND_COALESCE) {
            return ["(", result, ")"];
          }
          return parenthesize(result, currentPrecedence, precedence);
        },
        CallExpression: function(expr, precedence, flags) {
          var result, i2, iz;
          result = [this.generateExpression(expr.callee, Precedence.Call, E_TTF)];
          if (expr.optional) {
            result.push("?.");
          }
          result.push("(");
          for (i2 = 0, iz = expr["arguments"].length; i2 < iz; ++i2) {
            result.push(this.generateExpression(expr["arguments"][i2], Precedence.Assignment, E_TTT));
            if (i2 + 1 < iz) {
              result.push("," + space);
            }
          }
          result.push(")");
          if (!(flags & F_ALLOW_CALL)) {
            return ["(", result, ")"];
          }
          return parenthesize(result, Precedence.Call, precedence);
        },
        ChainExpression: function(expr, precedence, flags) {
          if (Precedence.OptionalChaining < precedence) {
            flags |= F_ALLOW_CALL;
          }
          var result = this.generateExpression(expr.expression, Precedence.OptionalChaining, flags);
          return parenthesize(result, Precedence.OptionalChaining, precedence);
        },
        NewExpression: function(expr, precedence, flags) {
          var result, length, i2, iz, itemFlags;
          length = expr["arguments"].length;
          itemFlags = flags & F_ALLOW_UNPARATH_NEW && !parentheses && length === 0 ? E_TFT : E_TFF;
          result = join(
            "new",
            this.generateExpression(expr.callee, Precedence.New, itemFlags)
          );
          if (!(flags & F_ALLOW_UNPARATH_NEW) || parentheses || length > 0) {
            result.push("(");
            for (i2 = 0, iz = length; i2 < iz; ++i2) {
              result.push(this.generateExpression(expr["arguments"][i2], Precedence.Assignment, E_TTT));
              if (i2 + 1 < iz) {
                result.push("," + space);
              }
            }
            result.push(")");
          }
          return parenthesize(result, Precedence.New, precedence);
        },
        MemberExpression: function(expr, precedence, flags) {
          var result, fragment;
          result = [this.generateExpression(expr.object, Precedence.Call, flags & F_ALLOW_CALL ? E_TTF : E_TFF)];
          if (expr.computed) {
            if (expr.optional) {
              result.push("?.");
            }
            result.push("[");
            result.push(this.generateExpression(expr.property, Precedence.Sequence, flags & F_ALLOW_CALL ? E_TTT : E_TFT));
            result.push("]");
          } else {
            if (!expr.optional && expr.object.type === Syntax.Literal && typeof expr.object.value === "number") {
              fragment = toSourceNodeWhenNeeded(result).toString();
              if (fragment.indexOf(".") < 0 && !/[eExX]/.test(fragment) && esutils.code.isDecimalDigit(fragment.charCodeAt(fragment.length - 1)) && !(fragment.length >= 2 && fragment.charCodeAt(0) === 48)) {
                result.push(" ");
              }
            }
            result.push(expr.optional ? "?." : ".");
            result.push(generateIdentifier(expr.property));
          }
          return parenthesize(result, Precedence.Member, precedence);
        },
        MetaProperty: function(expr, precedence, flags) {
          var result;
          result = [];
          result.push(typeof expr.meta === "string" ? expr.meta : generateIdentifier(expr.meta));
          result.push(".");
          result.push(typeof expr.property === "string" ? expr.property : generateIdentifier(expr.property));
          return parenthesize(result, Precedence.Member, precedence);
        },
        UnaryExpression: function(expr, precedence, flags) {
          var result, fragment, rightCharCode, leftSource, leftCharCode;
          fragment = this.generateExpression(expr.argument, Precedence.Unary, E_TTT);
          if (space === "") {
            result = join(expr.operator, fragment);
          } else {
            result = [expr.operator];
            if (expr.operator.length > 2) {
              result = join(result, fragment);
            } else {
              leftSource = toSourceNodeWhenNeeded(result).toString();
              leftCharCode = leftSource.charCodeAt(leftSource.length - 1);
              rightCharCode = fragment.toString().charCodeAt(0);
              if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPartES5(leftCharCode) && esutils.code.isIdentifierPartES5(rightCharCode)) {
                result.push(noEmptySpace());
                result.push(fragment);
              } else {
                result.push(fragment);
              }
            }
          }
          return parenthesize(result, Precedence.Unary, precedence);
        },
        YieldExpression: function(expr, precedence, flags) {
          var result;
          if (expr.delegate) {
            result = "yield*";
          } else {
            result = "yield";
          }
          if (expr.argument) {
            result = join(
              result,
              this.generateExpression(expr.argument, Precedence.Yield, E_TTT)
            );
          }
          return parenthesize(result, Precedence.Yield, precedence);
        },
        AwaitExpression: function(expr, precedence, flags) {
          var result = join(
            expr.all ? "await*" : "await",
            this.generateExpression(expr.argument, Precedence.Await, E_TTT)
          );
          return parenthesize(result, Precedence.Await, precedence);
        },
        UpdateExpression: function(expr, precedence, flags) {
          if (expr.prefix) {
            return parenthesize(
              [
                expr.operator,
                this.generateExpression(expr.argument, Precedence.Unary, E_TTT)
              ],
              Precedence.Unary,
              precedence
            );
          }
          return parenthesize(
            [
              this.generateExpression(expr.argument, Precedence.Postfix, E_TTT),
              expr.operator
            ],
            Precedence.Postfix,
            precedence
          );
        },
        FunctionExpression: function(expr, precedence, flags) {
          var result = [
            generateAsyncPrefix(expr, true),
            "function"
          ];
          if (expr.id) {
            result.push(generateStarSuffix(expr) || noEmptySpace());
            result.push(generateIdentifier(expr.id));
          } else {
            result.push(generateStarSuffix(expr) || space);
          }
          result.push(this.generateFunctionBody(expr));
          return result;
        },
        ArrayPattern: function(expr, precedence, flags) {
          return this.ArrayExpression(expr, precedence, flags, true);
        },
        ArrayExpression: function(expr, precedence, flags, isPattern) {
          var result, multiline, that = this;
          if (!expr.elements.length) {
            return "[]";
          }
          multiline = isPattern ? false : expr.elements.length > 1;
          result = ["[", multiline ? newline : ""];
          withIndent(function(indent2) {
            var i2, iz;
            for (i2 = 0, iz = expr.elements.length; i2 < iz; ++i2) {
              if (!expr.elements[i2]) {
                if (multiline) {
                  result.push(indent2);
                }
                if (i2 + 1 === iz) {
                  result.push(",");
                }
              } else {
                result.push(multiline ? indent2 : "");
                result.push(that.generateExpression(expr.elements[i2], Precedence.Assignment, E_TTT));
              }
              if (i2 + 1 < iz) {
                result.push("," + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : "");
          result.push("]");
          return result;
        },
        RestElement: function(expr, precedence, flags) {
          return "..." + this.generatePattern(expr.argument);
        },
        ClassExpression: function(expr, precedence, flags) {
          var result, fragment;
          result = ["class"];
          if (expr.id) {
            result = join(result, this.generateExpression(expr.id, Precedence.Sequence, E_TTT));
          }
          if (expr.superClass) {
            fragment = join("extends", this.generateExpression(expr.superClass, Precedence.Unary, E_TTT));
            result = join(result, fragment);
          }
          result.push(space);
          result.push(this.generateStatement(expr.body, S_TFFT));
          return result;
        },
        MethodDefinition: function(expr, precedence, flags) {
          var result, fragment;
          if (expr["static"]) {
            result = ["static" + space];
          } else {
            result = [];
          }
          if (expr.kind === "get" || expr.kind === "set") {
            fragment = [
              join(expr.kind, this.generatePropertyKey(expr.key, expr.computed)),
              this.generateFunctionBody(expr.value)
            ];
          } else {
            fragment = [
              generateMethodPrefix(expr),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          return join(result, fragment);
        },
        Property: function(expr, precedence, flags) {
          if (expr.kind === "get" || expr.kind === "set") {
            return [
              expr.kind,
              noEmptySpace(),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          if (expr.shorthand) {
            if (expr.value.type === "AssignmentPattern") {
              return this.AssignmentPattern(expr.value, Precedence.Sequence, E_TTT);
            }
            return this.generatePropertyKey(expr.key, expr.computed);
          }
          if (expr.method) {
            return [
              generateMethodPrefix(expr),
              this.generatePropertyKey(expr.key, expr.computed),
              this.generateFunctionBody(expr.value)
            ];
          }
          return [
            this.generatePropertyKey(expr.key, expr.computed),
            ":" + space,
            this.generateExpression(expr.value, Precedence.Assignment, E_TTT)
          ];
        },
        ObjectExpression: function(expr, precedence, flags) {
          var multiline, result, fragment, that = this;
          if (!expr.properties.length) {
            return "{}";
          }
          multiline = expr.properties.length > 1;
          withIndent(function() {
            fragment = that.generateExpression(expr.properties[0], Precedence.Sequence, E_TTT);
          });
          if (!multiline) {
            if (!hasLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              return ["{", space, fragment, space, "}"];
            }
          }
          withIndent(function(indent2) {
            var i2, iz;
            result = ["{", newline, indent2, fragment];
            if (multiline) {
              result.push("," + newline);
              for (i2 = 1, iz = expr.properties.length; i2 < iz; ++i2) {
                result.push(indent2);
                result.push(that.generateExpression(expr.properties[i2], Precedence.Sequence, E_TTT));
                if (i2 + 1 < iz) {
                  result.push("," + newline);
                }
              }
            }
          });
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(base);
          result.push("}");
          return result;
        },
        AssignmentPattern: function(expr, precedence, flags) {
          return this.generateAssignment(expr.left, expr.right, "=", precedence, flags);
        },
        ObjectPattern: function(expr, precedence, flags) {
          var result, i2, iz, multiline, property, that = this;
          if (!expr.properties.length) {
            return "{}";
          }
          multiline = false;
          if (expr.properties.length === 1) {
            property = expr.properties[0];
            if (property.type === Syntax.Property && property.value.type !== Syntax.Identifier) {
              multiline = true;
            }
          } else {
            for (i2 = 0, iz = expr.properties.length; i2 < iz; ++i2) {
              property = expr.properties[i2];
              if (property.type === Syntax.Property && !property.shorthand) {
                multiline = true;
                break;
              }
            }
          }
          result = ["{", multiline ? newline : ""];
          withIndent(function(indent2) {
            var i3, iz2;
            for (i3 = 0, iz2 = expr.properties.length; i3 < iz2; ++i3) {
              result.push(multiline ? indent2 : "");
              result.push(that.generateExpression(expr.properties[i3], Precedence.Sequence, E_TTT));
              if (i3 + 1 < iz2) {
                result.push("," + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : "");
          result.push("}");
          return result;
        },
        ThisExpression: function(expr, precedence, flags) {
          return "this";
        },
        Super: function(expr, precedence, flags) {
          return "super";
        },
        Identifier: function(expr, precedence, flags) {
          return generateIdentifier(expr);
        },
        ImportDefaultSpecifier: function(expr, precedence, flags) {
          return generateIdentifier(expr.id || expr.local);
        },
        ImportNamespaceSpecifier: function(expr, precedence, flags) {
          var result = ["*"];
          var id2 = expr.id || expr.local;
          if (id2) {
            result.push(space + "as" + noEmptySpace() + generateIdentifier(id2));
          }
          return result;
        },
        ImportSpecifier: function(expr, precedence, flags) {
          var imported = expr.imported;
          var result = [imported.name];
          var local = expr.local;
          if (local && local.name !== imported.name) {
            result.push(noEmptySpace() + "as" + noEmptySpace() + generateIdentifier(local));
          }
          return result;
        },
        ExportSpecifier: function(expr, precedence, flags) {
          var local = expr.local;
          var result = [local.name];
          var exported = expr.exported;
          if (exported && exported.name !== local.name) {
            result.push(noEmptySpace() + "as" + noEmptySpace() + generateIdentifier(exported));
          }
          return result;
        },
        Literal: function(expr, precedence, flags) {
          var raw;
          if (expr.hasOwnProperty("raw") && parse5 && extra.raw) {
            try {
              raw = parse5(expr.raw).body[0].expression;
              if (raw.type === Syntax.Literal) {
                if (raw.value === expr.value) {
                  return expr.raw;
                }
              }
            } catch (e) {
            }
          }
          if (expr.regex) {
            return "/" + expr.regex.pattern + "/" + expr.regex.flags;
          }
          if (typeof expr.value === "bigint") {
            return expr.value.toString() + "n";
          }
          if (expr.bigint) {
            return expr.bigint + "n";
          }
          if (expr.value === null) {
            return "null";
          }
          if (typeof expr.value === "string") {
            return escapeString(expr.value);
          }
          if (typeof expr.value === "number") {
            return generateNumber(expr.value);
          }
          if (typeof expr.value === "boolean") {
            return expr.value ? "true" : "false";
          }
          return generateRegExp(expr.value);
        },
        GeneratorExpression: function(expr, precedence, flags) {
          return this.ComprehensionExpression(expr, precedence, flags);
        },
        ComprehensionExpression: function(expr, precedence, flags) {
          var result, i2, iz, fragment, that = this;
          result = expr.type === Syntax.GeneratorExpression ? ["("] : ["["];
          if (extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = this.generateExpression(expr.body, Precedence.Assignment, E_TTT);
            result.push(fragment);
          }
          if (expr.blocks) {
            withIndent(function() {
              for (i2 = 0, iz = expr.blocks.length; i2 < iz; ++i2) {
                fragment = that.generateExpression(expr.blocks[i2], Precedence.Sequence, E_TTT);
                if (i2 > 0 || extra.moz.comprehensionExpressionStartsWithAssignment) {
                  result = join(result, fragment);
                } else {
                  result.push(fragment);
                }
              }
            });
          }
          if (expr.filter) {
            result = join(result, "if" + space);
            fragment = this.generateExpression(expr.filter, Precedence.Sequence, E_TTT);
            result = join(result, ["(", fragment, ")"]);
          }
          if (!extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = this.generateExpression(expr.body, Precedence.Assignment, E_TTT);
            result = join(result, fragment);
          }
          result.push(expr.type === Syntax.GeneratorExpression ? ")" : "]");
          return result;
        },
        ComprehensionBlock: function(expr, precedence, flags) {
          var fragment;
          if (expr.left.type === Syntax.VariableDeclaration) {
            fragment = [
              expr.left.kind,
              noEmptySpace(),
              this.generateStatement(expr.left.declarations[0], S_FFFF)
            ];
          } else {
            fragment = this.generateExpression(expr.left, Precedence.Call, E_TTT);
          }
          fragment = join(fragment, expr.of ? "of" : "in");
          fragment = join(fragment, this.generateExpression(expr.right, Precedence.Sequence, E_TTT));
          return ["for" + space + "(", fragment, ")"];
        },
        SpreadElement: function(expr, precedence, flags) {
          return [
            "...",
            this.generateExpression(expr.argument, Precedence.Assignment, E_TTT)
          ];
        },
        TaggedTemplateExpression: function(expr, precedence, flags) {
          var itemFlags = E_TTF;
          if (!(flags & F_ALLOW_CALL)) {
            itemFlags = E_TFF;
          }
          var result = [
            this.generateExpression(expr.tag, Precedence.Call, itemFlags),
            this.generateExpression(expr.quasi, Precedence.Primary, E_FFT)
          ];
          return parenthesize(result, Precedence.TaggedTemplate, precedence);
        },
        TemplateElement: function(expr, precedence, flags) {
          return expr.value.raw;
        },
        TemplateLiteral: function(expr, precedence, flags) {
          var result, i2, iz;
          result = ["`"];
          for (i2 = 0, iz = expr.quasis.length; i2 < iz; ++i2) {
            result.push(this.generateExpression(expr.quasis[i2], Precedence.Primary, E_TTT));
            if (i2 + 1 < iz) {
              result.push("${" + space);
              result.push(this.generateExpression(expr.expressions[i2], Precedence.Sequence, E_TTT));
              result.push(space + "}");
            }
          }
          result.push("`");
          return result;
        },
        ModuleSpecifier: function(expr, precedence, flags) {
          return this.Literal(expr, precedence, flags);
        },
        ImportExpression: function(expr, precedence, flag) {
          return parenthesize([
            "import(",
            this.generateExpression(expr.source, Precedence.Assignment, E_TTT),
            ")"
          ], Precedence.Call, precedence);
        }
      };
      merge(CodeGenerator.prototype, CodeGenerator.Expression);
      CodeGenerator.prototype.generateExpression = function(expr, precedence, flags) {
        var result, type;
        type = expr.type || Syntax.Property;
        if (extra.verbatim && expr.hasOwnProperty(extra.verbatim)) {
          return generateVerbatim(expr, precedence);
        }
        result = this[type](expr, precedence, flags);
        if (extra.comment) {
          result = addComments(expr, result);
        }
        return toSourceNodeWhenNeeded(result, expr);
      };
      CodeGenerator.prototype.generateStatement = function(stmt, flags) {
        var result, fragment;
        result = this[stmt.type](stmt, flags);
        if (extra.comment) {
          result = addComments(stmt, result);
        }
        fragment = toSourceNodeWhenNeeded(result).toString();
        if (stmt.type === Syntax.Program && !safeConcatenation && newline === "" && fragment.charAt(fragment.length - 1) === "\n") {
          result = sourceMap ? toSourceNodeWhenNeeded(result).replaceRight(/\s+$/, "") : fragment.replace(/\s+$/, "");
        }
        return toSourceNodeWhenNeeded(result, stmt);
      };
      function generateInternal(node) {
        var codegen;
        codegen = new CodeGenerator();
        if (isStatement(node)) {
          return codegen.generateStatement(node, S_TFFF);
        }
        if (isExpression(node)) {
          return codegen.generateExpression(node, Precedence.Sequence, E_TTT);
        }
        throw new Error("Unknown node type: " + node.type);
      }
      function generate(node, options) {
        var defaultOptions2 = getDefaultOptions(), result, pair;
        if (options != null) {
          if (typeof options.indent === "string") {
            defaultOptions2.format.indent.style = options.indent;
          }
          if (typeof options.base === "number") {
            defaultOptions2.format.indent.base = options.base;
          }
          options = updateDeeply(defaultOptions2, options);
          indent = options.format.indent.style;
          if (typeof options.base === "string") {
            base = options.base;
          } else {
            base = stringRepeat(indent, options.format.indent.base);
          }
        } else {
          options = defaultOptions2;
          indent = options.format.indent.style;
          base = stringRepeat(indent, options.format.indent.base);
        }
        json = options.format.json;
        renumber = options.format.renumber;
        hexadecimal = json ? false : options.format.hexadecimal;
        quotes = json ? "double" : options.format.quotes;
        escapeless = options.format.escapeless;
        newline = options.format.newline;
        space = options.format.space;
        if (options.format.compact) {
          newline = space = indent = base = "";
        }
        parentheses = options.format.parentheses;
        semicolons = options.format.semicolons;
        safeConcatenation = options.format.safeConcatenation;
        directive = options.directive;
        parse5 = json ? null : options.parse;
        sourceMap = options.sourceMap;
        sourceCode = options.sourceCode;
        preserveBlankLines = options.format.preserveBlankLines && sourceCode !== null;
        extra = options;
        if (sourceMap) {
          if (!exports.browser) {
            SourceNode = require_source_map().SourceNode;
          } else {
            SourceNode = global.sourceMap.SourceNode;
          }
        }
        result = generateInternal(node);
        if (!sourceMap) {
          pair = { code: result.toString(), map: null };
          return options.sourceMapWithCode ? pair : pair.code;
        }
        pair = result.toStringWithSourceMap({
          file: options.file,
          sourceRoot: options.sourceMapRoot
        });
        if (options.sourceContent) {
          pair.map.setSourceContent(
            options.sourceMap,
            options.sourceContent
          );
        }
        if (options.sourceMapWithCode) {
          return pair;
        }
        return pair.map.toString();
      }
      FORMAT_MINIFY = {
        indent: {
          style: "",
          base: 0
        },
        renumber: true,
        hexadecimal: true,
        quotes: "auto",
        escapeless: true,
        compact: true,
        parentheses: false,
        semicolons: false
      };
      FORMAT_DEFAULTS = getDefaultOptions().format;
      exports.version = require_package().version;
      exports.generate = generate;
      exports.attachComments = estraverse.attachComments;
      exports.Precedence = updateDeeply({}, Precedence);
      exports.browser = false;
      exports.FORMAT_MINIFY = FORMAT_MINIFY;
      exports.FORMAT_DEFAULTS = FORMAT_DEFAULTS;
    })();
  }
});

// node_modules/@strudel/core/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  ClockCollator: () => _n,
  Cyclist: () => hf,
  FXr: () => uf,
  FXrel: () => cf,
  FXrelease: () => of,
  Fraction: () => m,
  Hap: () => S,
  Pattern: () => f,
  State: () => ut,
  TimeSpan: () => B,
  __chooseWith: () => Me,
  _brandBy: () => Oe,
  _fitslice: () => Fn,
  _irand: () => ze,
  _keyDown: () => je,
  _match: () => In,
  _mod: () => bt,
  _morph: () => de,
  _polymeterListSteps: () => Hn,
  _retime: () => Yt,
  _slices: () => Zt,
  accelerate: () => Ys,
  activeLabel: () => va,
  ad: () => Bp,
  add: () => $h,
  adsr: () => xp,
  almostAlways: () => Jw,
  almostNever: () => jw,
  always: () => Nw,
  amp: () => sr,
  analyze: () => gc,
  anchor: () => Ua,
  and: () => nd,
  apply: () => Pd,
  applyN: () => Wn,
  ar: () => zp,
  arp: () => wh,
  arpWith: () => yh,
  arrange: () => kh,
  as: () => Kp,
  asym: () => py,
  att: () => or,
  attack: () => rr,
  averageArray: () => nn,
  backgroundImage: () => Hw,
  band: () => Ih,
  bandf: () => Cc,
  bandq: () => Oc,
  bank: () => yc,
  base64ToUnicode: () => gn,
  bbexpr: () => ti,
  bbst: () => ni,
  beat: () => oy,
  begin: () => Mc,
  berlin: () => qw,
  bgain: () => ja,
  binary: () => iw,
  binaryL: () => uw,
  binaryN: () => Jf,
  binaryNL: () => $f,
  bind: () => xh,
  binshift: () => Zl,
  bite: () => Ld,
  bjork: () => _y,
  bjorklund: () => ge,
  blshift: () => Dh,
  bmod: () => sf,
  bor: () => Vh,
  bp: () => Bc,
  bpa: () => ji,
  bpattack: () => Ei,
  bpd: () => Wi,
  bpdc: () => yu,
  bpdecay: () => Ri,
  bpdepth: () => fu,
  bpdepthfreq: () => du,
  bpdepthfrequency: () => hu,
  bpe: () => Bi,
  bpenv: () => xi,
  bpf: () => xc,
  bpq: () => zc,
  bpr: () => Zi,
  bprate: () => lu,
  bprelease: () => Yi,
  bps: () => Gi,
  bpshape: () => mu,
  bpskew: () => wu,
  bpsustain: () => Di,
  bpsync: () => pu,
  brak: () => Ud,
  brand: () => mw,
  brandBy: () => dw,
  brshift: () => Gh,
  bus: () => Pa,
  busgain: () => Ea,
  bxor: () => Hh,
  bypass: () => Tm,
  byteBeatExpression: () => Zc,
  byteBeatStartTime: () => ei,
  calculateSteps: () => dh,
  cat: () => mt,
  ccn: () => $p,
  ccv: () => Np,
  ceil: () => id,
  ch: () => ri,
  channel: () => gi,
  channels: () => si,
  chebyshev: () => dy,
  choose: () => Rf,
  chooseCycles: () => Wf,
  chooseIn: () => ww,
  chooseInWith: () => Pe,
  chooseOut: () => gw,
  chooseWith: () => It,
  chop: () => Xm,
  chord: () => Da,
  chorus: () => wc,
  chunk: () => mm,
  chunkBack: () => gm,
  chunkBackInto: () => Am,
  chunkInto: () => qm,
  chunkback: () => bm,
  chunkbackinto: () => Sm,
  chunkinto: () => km,
  clamp: () => an,
  cleanupUi: () => Dw,
  clip: () => pp,
  coarse: () => Rc,
  code2hash: () => ph,
  color: () => Ap,
  colour: () => Tp,
  comb: () => Xl,
  compose: () => oh,
  compress: () => dd,
  compressSpan: () => md,
  compressor: () => bl,
  compressorAttack: () => kl,
  compressorKnee: () => _l,
  compressorRatio: () => vl,
  compressorRelease: () => ql,
  compressspan: () => yd,
  constant: () => ch,
  contract: () => Kn,
  control: () => Jp,
  controls: () => gy,
  cosine: () => Qy,
  cosine2: () => Uy,
  cpm: () => Ed,
  cps: () => lp,
  createClock: () => ff,
  createParam: () => Nt,
  createParams: () => Cp,
  crush: () => Lc,
  ctf: () => vi,
  ctlNum: () => Lp,
  ctranspose: () => Aa,
  cubic: () => ay,
  curry: () => w,
  curve: () => yp,
  cut: () => bi,
  cutoff: () => _i,
  cycleToSeconds: () => Kt,
  cyclesPer: () => Ww,
  dec: () => vc,
  decay: () => _c,
  degrade: () => Tw,
  degradeBy: () => Aw,
  degradeByWith: () => Sw,
  degree: () => qa,
  delay: () => Ru,
  delayfb: () => Fu,
  delayfeedback: () => Wu,
  delayspeed: () => Vu,
  delaysync: () => Qu,
  delayt: () => Du,
  delaytime: () => Hu,
  deltaSlide: () => wp,
  det: () => Ku,
  detune: () => Xu,
  dfb: () => Iu,
  dict: () => Qa,
  dictionary: () => Ga,
  diode: () => ly,
  dist: () => yl,
  distort: () => ml,
  distorttype: () => gl,
  distortvol: () => wl,
  div: () => Rh,
  djf: () => Lu,
  drawLine: () => Cn,
  drive: () => Qc,
  drop: () => Qn,
  dry: () => ta,
  ds: () => Op,
  dt: () => Gu,
  duck: () => Uc,
  duckattack: () => Yc,
  duckdepth: () => Xc,
  duckonset: () => Kc,
  dur: () => dp,
  duration: () => hp,
  early: () => jd,
  echo: () => im,
  echoWith: () => sm,
  echowith: () => rm,
  eish: () => Ty,
  end: () => Pc,
  enhance: () => Ul,
  env: () => nf,
  eq: () => Yh,
  eqt: () => Zh,
  errorLogger: () => zt,
  euclid: () => by,
  euclidLegato: () => qy,
  euclidLegatoRot: () => Sy,
  euclidRot: () => ky,
  euclidish: () => Ay,
  euclidrot: () => vy,
  evalScope: () => xn,
  evaluate: () => On,
  every: () => Md,
  expand: () => Xn,
  expression: () => Ol,
  extend: () => Un,
  fadeInTime: () => sa,
  fadeOutTime: () => na,
  fadeTime: () => ea,
  fanchor: () => eu,
  fast: () => qd,
  fastChunk: () => vm,
  fastGap: () => wd,
  fastcat: () => N,
  fastchunk: () => _m,
  fastgap: () => gd,
  fft: () => bc,
  filter: () => zm,
  filterWhen: () => Mm,
  firstOf: () => zd,
  fit: () => ey,
  flatten: () => G,
  floor: () => cd,
  fm: () => Sr,
  fm1: () => Ar,
  fm2: () => Tr,
  fm3: () => Cr,
  fm4: () => xr,
  fm5: () => Br,
  fm6: () => Or,
  fm7: () => zr,
  fm8: () => Mr,
  fmatt: () => Kr,
  fmatt1: () => Yr,
  fmatt2: () => Zr,
  fmatt3: () => to,
  fmatt4: () => eo,
  fmatt5: () => no,
  fmatt6: () => so,
  fmatt7: () => ro,
  fmatt8: () => oo,
  fmattack: () => Fr,
  fmattack1: () => Ir,
  fmattack2: () => Vr,
  fmattack3: () => Hr,
  fmattack4: () => Dr,
  fmattack5: () => Gr,
  fmattack6: () => Qr,
  fmattack7: () => Ur,
  fmattack8: () => Xr,
  fmdec: () => Ao,
  fmdec1: () => To,
  fmdec2: () => Co,
  fmdec3: () => xo,
  fmdec4: () => Bo,
  fmdec5: () => Oo,
  fmdec6: () => zo,
  fmdec7: () => Mo,
  fmdec8: () => Po,
  fmdecay: () => yo,
  fmdecay1: () => wo,
  fmdecay2: () => go,
  fmdecay3: () => bo,
  fmdecay4: () => _o,
  fmdecay5: () => vo,
  fmdecay6: () => ko,
  fmdecay7: () => qo,
  fmdecay8: () => So,
  fmenv: () => Pr,
  fmenv1: () => Er,
  fmenv2: () => jr,
  fmenv3: () => Jr,
  fmenv4: () => $r,
  fmenv5: () => Nr,
  fmenv6: () => Lr,
  fmenv7: () => Rr,
  fmenv8: () => Wr,
  fmh: () => cr,
  fmh1: () => ir,
  fmh2: () => ur,
  fmh3: () => ar,
  fmh4: () => lr,
  fmh5: () => pr,
  fmh6: () => fr,
  fmh7: () => hr,
  fmh8: () => dr,
  fmi: () => mr,
  fmi1: () => yr,
  fmi2: () => wr,
  fmi3: () => gr,
  fmi4: () => br,
  fmi5: () => _r,
  fmi6: () => vr,
  fmi7: () => kr,
  fmi8: () => qr,
  fmrel: () => ic,
  fmrel1: () => uc,
  fmrel2: () => ac,
  fmrel3: () => lc,
  fmrel4: () => pc,
  fmrel5: () => fc,
  fmrel6: () => hc,
  fmrel7: () => dc,
  fmrel8: () => mc,
  fmrelease: () => Yo,
  fmrelease1: () => Zo,
  fmrelease2: () => tc,
  fmrelease3: () => ec,
  fmrelease4: () => nc,
  fmrelease5: () => sc,
  fmrelease6: () => rc,
  fmrelease7: () => oc,
  fmrelease8: () => cc,
  fmsus: () => Io,
  fmsus1: () => Vo,
  fmsus2: () => Ho,
  fmsus3: () => Do,
  fmsus4: () => Go,
  fmsus5: () => Qo,
  fmsus6: () => Uo,
  fmsus7: () => Xo,
  fmsus8: () => Ko,
  fmsustain: () => Eo,
  fmsustain1: () => jo,
  fmsustain2: () => Jo,
  fmsustain3: () => $o,
  fmsustain4: () => No,
  fmsustain5: () => Lo,
  fmsustain6: () => Ro,
  fmsustain7: () => Wo,
  fmsustain8: () => Fo,
  fmwave: () => co,
  fmwave1: () => io,
  fmwave2: () => uo,
  fmwave3: () => ao,
  fmwave4: () => lo,
  fmwave5: () => po,
  fmwave6: () => fo,
  fmwave7: () => ho,
  fmwave8: () => mo,
  focus: () => bd,
  focusSpan: () => _d,
  focusspan: () => vd,
  fold: () => fy,
  fractionalArgs: () => ih,
  frameRate: () => np,
  frames: () => sp,
  freeze: () => Vl,
  freq: () => ra,
  freqToMidi: () => Ze,
  fromBipolar: () => ad,
  fshift: () => Ml,
  fshiftnote: () => Pl,
  fshiftphase: () => El,
  ftype: () => tu,
  func: () => rd,
  fxr: () => af,
  gain: () => er,
  gap: () => pt,
  gat: () => wa,
  gate: () => ya,
  getAccidentalsOffset: () => Ye,
  getControlName: () => yt,
  getCps: () => Fy,
  getCurrentKeyboardState: () => qn,
  getEventOffsetMs: () => th,
  getFreq: () => tn,
  getFrequency: () => rh,
  getIsStarted: () => Hy,
  getPattern: () => Iy,
  getPerformanceTimeSeconds: () => hh,
  getPlayableNoteValue: () => sh,
  getRandsAtTime: () => K,
  getSoundIndex: () => nh,
  getTime: () => Wy,
  getTrigger: () => Sf,
  getTriggerFunc: () => Vy,
  grow: () => jm,
  gt: () => Uh,
  gte: () => Kh,
  hard: () => uy,
  harmonic: () => Ta,
  hash2code: () => fh,
  hbrick: () => tp,
  hcutoff: () => Mu,
  hold: () => Tc,
  hours: () => rp,
  hp: () => Eu,
  hpa: () => Pi,
  hpattack: () => Mi,
  hpd: () => Li,
  hpdc: () => Su,
  hpdecay: () => Ni,
  hpdepth: () => _u,
  hpdepthfreq: () => ku,
  hpdepthfrequency: () => vu,
  hpe: () => Ci,
  hpenv: () => Ti,
  hpf: () => Pu,
  hpq: () => Ju,
  hpr: () => Ki,
  hprate: () => gu,
  hprelease: () => Xi,
  hps: () => Hi,
  hpshape: () => qu,
  hpskew: () => Au,
  hpsustain: () => Vi,
  hpsync: () => bu,
  hresonance: () => ju,
  hsl: () => Om,
  hsla: () => Bm,
  hurry: () => Ad,
  id: () => ot,
  imag: () => Ql,
  inhabit: () => Jy,
  inhabitmod: () => Ny,
  innerBind: () => Bh,
  inside: () => xd,
  inv: () => Dd,
  invert: () => Hd,
  ir: () => cl,
  irand: () => yw,
  irbegin: () => al,
  iresponse: () => il,
  irspeed: () => ul,
  isControlName: () => is,
  isNote: () => Mt,
  isNoteWithOctave: () => Yf,
  isPattern: () => pe,
  isaw: () => Rt,
  isaw2: () => Ae,
  iter: () => pm,
  iterBack: () => fm,
  iterback: () => hm,
  itri: () => Zy,
  itri2: () => tw,
  jux: () => nm,
  juxBy: () => tm,
  juxby: () => em,
  kcutoff: () => $l,
  keep: () => jh,
  keepif: () => Jh,
  keyAlias: () => kn,
  keyDown: () => Rw,
  krush: () => Jl,
  label: () => ka,
  lastOf: () => Od,
  late: () => Ln,
  lbrick: () => ep,
  legato: () => fp,
  leslie: () => ga,
  lfo: () => ef,
  linger: () => Rd,
  listRange: () => _t,
  lock: () => Uu,
  logKey: () => oe,
  logger: () => E,
  loop: () => Ec,
  loopAt: () => Zm,
  loopAtCps: () => ny,
  loopBegin: () => jc,
  loopEnd: () => $c,
  loopat: () => ty,
  loopatcps: () => sy,
  loopb: () => Jc,
  loope: () => Nc,
  lp: () => qi,
  lpa: () => zi,
  lpattack: () => Oi,
  lpd: () => $i,
  lpdc: () => uu,
  lpdecay: () => Ji,
  lpdepth: () => ru,
  lpdepthfreq: () => cu,
  lpdepthfrequency: () => ou,
  lpe: () => Ai,
  lpenv: () => Si,
  lpf: () => ki,
  lpq: () => Nu,
  lpr: () => Ui,
  lprate: () => nu,
  lprelease: () => Qi,
  lps: () => Ii,
  lpshape: () => iu,
  lpskew: () => au,
  lpsustain: () => Fi,
  lpsync: () => su,
  lrate: () => ba,
  lsize: () => _a,
  lt: () => Qh,
  lte: () => Xh,
  mapArgs: () => ie,
  mask: () => Sh,
  midi2note: () => eh,
  midiToFreq: () => it,
  midibend: () => Dp,
  midichan: () => Mp,
  midicmd: () => jp,
  midimap: () => Pp,
  midiport: () => Ep,
  miditouch: () => Gp,
  minutes: () => op,
  mod: () => Wh,
  mode: () => Ya,
  morph: () => cy,
  mouseX: () => ow,
  mouseY: () => sw,
  mousex: () => rw,
  mousey: () => nw,
  mtranspose: () => Sa,
  mul: () => Lh,
  n: () => Xs,
  nanFallback: () => sn,
  ne: () => td,
  net: () => ed,
  never: () => $w,
  noise: () => Bu,
  note: () => Ks,
  noteToMidi: () => gt,
  nothing: () => R,
  nrpnn: () => Rp,
  nrpv: () => Wp,
  nudge: () => Ba,
  numeralArgs: () => L,
  objectMap: () => bn,
  oct: () => za,
  octave: () => Oa,
  octaveR: () => xa,
  octaves: () => Ka,
  octer: () => Nl,
  octersub: () => Ll,
  octersubsub: () => Rl,
  off: () => Qd,
  offset: () => Xa,
  often: () => Pw,
  or: () => sd,
  orbit: () => Ma,
  oschost: () => Up,
  oscport: () => Xp,
  outerBind: () => Oh,
  outside: () => Bd,
  overgain: () => Ja,
  overshape: () => $a,
  pace: () => Vn,
  pairs: () => un,
  palindrome: () => Zd,
  pan: () => Na,
  panchor: () => ma,
  panorient: () => Fa,
  panspan: () => La,
  pansplay: () => Ra,
  panwidth: () => Wa,
  parray: () => me,
  parseFractional: () => cn,
  parseNumeral: () => ce,
  partials: () => my,
  patt: () => ca,
  pattack: () => oa,
  pcurve: () => da,
  pdec: () => ua,
  pdecay: () => ia,
  penv: () => ha,
  per: () => Df,
  perCycle: () => Fw,
  perlin: () => kw,
  perx: () => Iw,
  ph: () => ai,
  phasdp: () => wi,
  phaser: () => li,
  phasercenter: () => hi,
  phaserdepth: () => mi,
  phaserrate: () => ui,
  phasersweep: () => pi,
  phases: () => yy,
  phc: () => di,
  phd: () => yi,
  phs: () => fi,
  pick: () => yf,
  pickF: () => xy,
  pickOut: () => Oy,
  pickReset: () => Ey,
  pickRestart: () => My,
  pickSqueeze: () => $y,
  pickmod: () => gf,
  pickmodF: () => By,
  pickmodOut: () => zy,
  pickmodReset: () => jy,
  pickmodRestart: () => Py,
  pickmodSqueeze: () => Ly,
  pipe: () => on,
  pitchJump: () => gp,
  pitchJumpTime: () => bp,
  ply: () => kd,
  plyForEach: () => lm,
  plyWith: () => am,
  pm: () => _h,
  polyBind: () => Ph,
  polyTouch: () => Qp,
  polymeter: () => $t,
  polyrhythm: () => gh,
  postgain: () => nr,
  pow: () => Fh,
  pr: () => bh,
  prel: () => fa,
  prelease: () => pa,
  press: () => Yd,
  pressBy: () => Kd,
  progNum: () => Fp,
  psus: () => la,
  psustain: () => aa,
  pure: () => C,
  pw: () => oi,
  pwrate: () => ci,
  pwsweep: () => ii,
  rand: () => W,
  rand2: () => hw,
  randL: () => aw,
  randcat: () => bw,
  randrun: () => Nf,
  range: () => ld,
  range2: () => fd,
  rangex: () => pd,
  rarely: () => Ew,
  ratio: () => hd,
  rdim: () => sl,
  real: () => Gl,
  ref: () => ry,
  register: () => l,
  registerControl: () => c,
  registerMultiControl: () => V,
  reify: () => d,
  rel: () => Ac,
  release: () => Sc,
  removeUndefineds: () => lt,
  repeatCycles: () => dm,
  repl: () => Dy,
  replicate: () => Em,
  reset_state: () => df,
  reset_timelines: () => mf,
  resonance: () => $u,
  rev: () => Rn,
  revv: () => Xd,
  rfade: () => ol,
  rib: () => xm,
  ribbon: () => Cm,
  ring: () => Wl,
  ringdf: () => Il,
  ringf: () => Fl,
  rlp: () => el,
  room: () => Za,
  roomdim: () => nl,
  roomfade: () => rl,
  roomlp: () => tl,
  roomsize: () => ll,
  rotate: () => rn,
  round: () => od,
  rsize: () => hl,
  run: () => jf,
  s: () => us,
  s_add: () => Fm,
  s_alt: () => Nm,
  s_cat: () => $m,
  s_contract: () => Dm,
  s_expand: () => Vm,
  s_extend: () => Hm,
  s_polymeter: () => Lm,
  s_sub: () => Im,
  s_taper: () => Rm,
  s_taperlist: () => Wm,
  s_tour: () => Gm,
  s_zip: () => Qm,
  saw: () => qt,
  saw2: () => Se,
  scram: () => Yl,
  scramble: () => pw,
  scrub: () => Yp,
  seconds: () => cp,
  seed: () => fw,
  seg: () => Fd,
  segment: () => Wd,
  semitone: () => Va,
  seq: () => Nn,
  seqPLoop: () => qh,
  sequence: () => Q,
  sequenceP: () => En,
  set: () => Eh,
  setCpsFunc: () => _f,
  setIsStarted: () => qf,
  setPattern: () => vf,
  setStringParser: () => mh,
  setTime: () => ee,
  setTriggerFunc: () => kf,
  shape: () => dl,
  shrink: () => Zn,
  shrinklist: () => Yn,
  shuffle: () => lw,
  signal: () => j,
  silence: () => q,
  sine: () => Af,
  sine2: () => Te,
  sinefold: () => hy,
  size: () => pl,
  slice: () => ss,
  slide: () => Ia,
  slow: () => Td,
  slowChunk: () => wm,
  slowcat: () => Z,
  slowcatPrime: () => fe,
  slowchunk: () => ym,
  smear: () => Kl,
  soft: () => iy,
  sol2note: () => uh,
  someCycles: () => Mw,
  someCyclesBy: () => zw,
  sometimes: () => Ow,
  sometimesBy: () => Bw,
  songPtr: () => ip,
  sound: () => as,
  source: () => Qs,
  sparsity: () => Cd,
  speak: () => Vw,
  speed: () => ye,
  splice: () => Ym,
  splitAt: () => ue,
  spread: () => Zu,
  square: () => Tf,
  square2: () => Xy,
  squeeze: () => Ry,
  squeezeBind: () => zh,
  squiz: () => Tl,
  src: () => Us,
  stack: () => z,
  stackBy: () => vh,
  stackCentre: () => $n,
  stackLeft: () => jn,
  stackRight: () => Jn,
  steady: () => Gy,
  stepBind: () => Mh,
  stepalt: () => Dn,
  stepcat: () => $,
  steps: () => Um,
  stepsPerOctave: () => Ca,
  stretch: () => Sl,
  striate: () => Km,
  stringifyValues: () => ae,
  struct: () => Ah,
  strudelScope: () => le,
  stut: () => um,
  stutWith: () => om,
  stutwith: () => cm,
  sub: () => Nh,
  superimpose: () => Th,
  sus: () => qc,
  sustain: () => kc,
  sustainpedal: () => zl,
  swing: () => Vd,
  swingBy: () => Id,
  sysex: () => Ip,
  sysexdata: () => Hp,
  sysexid: () => Vp,
  sz: () => fl,
  take: () => Gn,
  time: () => ew,
  timeCat: () => ns,
  timecat: () => Jm,
  timeline: () => Cy,
  toBipolar: () => ud,
  tokenizeNote: () => Ue,
  tour: () => ts,
  transient: () => rf,
  trem: () => Fc,
  tremolo: () => Wc,
  tremolodepth: () => Vc,
  tremolophase: () => Dc,
  tremoloshape: () => Gc,
  tremoloskew: () => Hc,
  tremolosync: () => Ic,
  tri: () => Ky,
  tri2: () => Yy,
  triode: () => jl,
  tsdelay: () => Dl,
  uid: () => up,
  undegrade: () => xw,
  undegradeBy: () => Cw,
  unicodeToBase64: () => wn,
  uniq: () => ah,
  uniqsort: () => lh,
  uniqsortr: () => yn,
  unison: () => Yu,
  unit: () => Al,
  useRNG: () => cw,
  v: () => xu,
  val: () => ap,
  valueToMidi: () => Zf,
  vel: () => tr,
  velocity: () => Zs,
  vib: () => Tu,
  vibmod: () => Ou,
  vibrato: () => Cu,
  vmod: () => zu,
  voice: () => Ha,
  vowel: () => Cl,
  warp: () => Cs,
  warpatt: () => Os,
  warpattack: () => Bs,
  warpdc: () => Rs,
  warpdec: () => Ms,
  warpdecay: () => zs,
  warpdepth: () => Ns,
  warpenv: () => Ds,
  warpmode: () => Fs,
  warprate: () => $s,
  warprel: () => Js,
  warprelease: () => js,
  warpshape: () => Ls,
  warpskew: () => Ws,
  warpsus: () => Es,
  warpsustain: () => Ps,
  warpsync: () => Gs,
  waveloss: () => xl,
  wavetablePhaseRand: () => Hs,
  wavetablePosition: () => ps,
  wavetableWarp: () => xs,
  wavetableWarpMode: () => Is,
  wchoose: () => _w,
  wchooseCycles: () => If,
  when: () => Gd,
  whenKey: () => Lw,
  withSeed: () => Lf,
  withValue: () => Ch,
  within: () => Pm,
  worklet: () => wy,
  wrandcat: () => vw,
  wt: () => ls,
  wtatt: () => ds,
  wtattack: () => hs,
  wtdc: () => As,
  wtdec: () => ys,
  wtdecay: () => ms,
  wtdepth: () => qs,
  wtenv: () => fs,
  wtphaserand: () => Vs,
  wtrate: () => vs,
  wtrel: () => _s,
  wtrelease: () => bs,
  wtshape: () => Ss,
  wtskew: () => Ts,
  wtsus: () => gs,
  wtsustain: () => ws,
  wtsync: () => ks,
  xfade: () => rs,
  xsdelay: () => Hl,
  zcrush: () => kp,
  zdelay: () => qp,
  zip: () => es,
  zipWith: () => Pt,
  zmod: () => vp,
  znoise: () => _p,
  zoom: () => Jd,
  zoomArc: () => $d,
  zoomarc: () => Nd,
  zrand: () => mp,
  zzfx: () => Sp
});

// node_modules/fraction.js/dist/fraction.mjs
if (typeof BigInt === "undefined") BigInt = function(n) {
  if (isNaN(n)) throw new Error("");
  return n;
};
var C_ZERO = BigInt(0);
var C_ONE = BigInt(1);
var C_TWO = BigInt(2);
var C_THREE = BigInt(3);
var C_FIVE = BigInt(5);
var C_TEN = BigInt(10);
var MAX_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
var MAX_CYCLE_LEN = 2e3;
var P = {
  "s": C_ONE,
  "n": C_ZERO,
  "d": C_ONE
};
function assign(n, s) {
  try {
    n = BigInt(n);
  } catch (e) {
    throw InvalidParameter();
  }
  return n * s;
}
function ifloor(x) {
  return typeof x === "bigint" ? x : Math.floor(x);
}
function newFraction(n, d2) {
  if (d2 === C_ZERO) {
    throw DivisionByZero();
  }
  const f2 = Object.create(Fraction.prototype);
  f2["s"] = n < C_ZERO ? -C_ONE : C_ONE;
  n = n < C_ZERO ? -n : n;
  const a = gcd(n, d2);
  f2["n"] = n / a;
  f2["d"] = d2 / a;
  return f2;
}
var FACTORSTEPS = [C_TWO * C_TWO, C_TWO, C_TWO * C_TWO, C_TWO, C_TWO * C_TWO, C_TWO * C_THREE, C_TWO, C_TWO * C_THREE];
function factorize(n) {
  const factors = /* @__PURE__ */ Object.create(null);
  if (n <= C_ONE) {
    factors[n] = C_ONE;
    return factors;
  }
  const add = (p) => {
    factors[p] = (factors[p] || C_ZERO) + C_ONE;
  };
  while (n % C_TWO === C_ZERO) {
    add(C_TWO);
    n /= C_TWO;
  }
  while (n % C_THREE === C_ZERO) {
    add(C_THREE);
    n /= C_THREE;
  }
  while (n % C_FIVE === C_ZERO) {
    add(C_FIVE);
    n /= C_FIVE;
  }
  for (let si2 = 0, p = C_TWO + C_FIVE; p * p <= n; ) {
    while (n % p === C_ZERO) {
      add(p);
      n /= p;
    }
    p += FACTORSTEPS[si2];
    si2 = si2 + 1 & 7;
  }
  if (n > C_ONE) add(n);
  return factors;
}
var parse = function(p1, p2) {
  let n = C_ZERO, d2 = C_ONE, s = C_ONE;
  if (p1 === void 0 || p1 === null) {
  } else if (p2 !== void 0) {
    if (typeof p1 === "bigint") {
      n = p1;
    } else if (isNaN(p1)) {
      throw InvalidParameter();
    } else if (p1 % 1 !== 0) {
      throw NonIntegerParameter();
    } else {
      n = BigInt(p1);
    }
    if (typeof p2 === "bigint") {
      d2 = p2;
    } else if (isNaN(p2)) {
      throw InvalidParameter();
    } else if (p2 % 1 !== 0) {
      throw NonIntegerParameter();
    } else {
      d2 = BigInt(p2);
    }
    s = n * d2;
  } else if (typeof p1 === "object") {
    if ("d" in p1 && "n" in p1) {
      n = BigInt(p1["n"]);
      d2 = BigInt(p1["d"]);
      if ("s" in p1)
        n *= BigInt(p1["s"]);
    } else if (0 in p1) {
      n = BigInt(p1[0]);
      if (1 in p1)
        d2 = BigInt(p1[1]);
    } else if (typeof p1 === "bigint") {
      n = p1;
    } else {
      throw InvalidParameter();
    }
    s = n * d2;
  } else if (typeof p1 === "number") {
    if (isNaN(p1)) {
      throw InvalidParameter();
    }
    if (p1 < 0) {
      s = -C_ONE;
      p1 = -p1;
    }
    if (p1 % 1 === 0) {
      n = BigInt(p1);
    } else {
      let z4 = 1;
      let A3 = 0, B3 = 1;
      let C3 = 1, D2 = 1;
      let N3 = 1e7;
      if (p1 >= 1) {
        z4 = 10 ** Math.floor(1 + Math.log10(p1));
        p1 /= z4;
      }
      while (B3 <= N3 && D2 <= N3) {
        let M = (A3 + C3) / (B3 + D2);
        if (p1 === M) {
          if (B3 + D2 <= N3) {
            n = A3 + C3;
            d2 = B3 + D2;
          } else if (D2 > B3) {
            n = C3;
            d2 = D2;
          } else {
            n = A3;
            d2 = B3;
          }
          break;
        } else {
          if (p1 > M) {
            A3 += C3;
            B3 += D2;
          } else {
            C3 += A3;
            D2 += B3;
          }
          if (B3 > N3) {
            n = C3;
            d2 = D2;
          } else {
            n = A3;
            d2 = B3;
          }
        }
      }
      n = BigInt(n) * BigInt(z4);
      d2 = BigInt(d2);
    }
  } else if (typeof p1 === "string") {
    let ndx = 0;
    let v = C_ZERO, w2 = C_ZERO, x = C_ZERO, y = C_ONE, z4 = C_ONE;
    let match = p1.replace(/_/g, "").match(/\d+|./g);
    if (match === null)
      throw InvalidParameter();
    if (match[ndx] === "-") {
      s = -C_ONE;
      ndx++;
    } else if (match[ndx] === "+") {
      ndx++;
    }
    if (match.length === ndx + 1) {
      w2 = assign(match[ndx++], s);
    } else if (match[ndx + 1] === "." || match[ndx] === ".") {
      if (match[ndx] !== ".") {
        v = assign(match[ndx++], s);
      }
      ndx++;
      if (ndx + 1 === match.length || match[ndx + 1] === "(" && match[ndx + 3] === ")" || match[ndx + 1] === "'" && match[ndx + 3] === "'") {
        w2 = assign(match[ndx], s);
        y = C_TEN ** BigInt(match[ndx].length);
        ndx++;
      }
      if (match[ndx] === "(" && match[ndx + 2] === ")" || match[ndx] === "'" && match[ndx + 2] === "'") {
        x = assign(match[ndx + 1], s);
        z4 = C_TEN ** BigInt(match[ndx + 1].length) - C_ONE;
        ndx += 3;
      }
    } else if (match[ndx + 1] === "/" || match[ndx + 1] === ":") {
      w2 = assign(match[ndx], s);
      y = assign(match[ndx + 2], C_ONE);
      ndx += 3;
    } else if (match[ndx + 3] === "/" && match[ndx + 1] === " ") {
      v = assign(match[ndx], s);
      w2 = assign(match[ndx + 2], s);
      y = assign(match[ndx + 4], C_ONE);
      ndx += 5;
    }
    if (match.length <= ndx) {
      d2 = y * z4;
      s = /* void */
      n = x + d2 * v + z4 * w2;
    } else {
      throw InvalidParameter();
    }
  } else if (typeof p1 === "bigint") {
    n = p1;
    s = p1;
    d2 = C_ONE;
  } else {
    throw InvalidParameter();
  }
  if (d2 === C_ZERO) {
    throw DivisionByZero();
  }
  P["s"] = s < C_ZERO ? -C_ONE : C_ONE;
  P["n"] = n < C_ZERO ? -n : n;
  P["d"] = d2 < C_ZERO ? -d2 : d2;
};
function modpow(b2, e, m3) {
  let r = C_ONE;
  for (; e > C_ZERO; b2 = b2 * b2 % m3, e >>= C_ONE) {
    if (e & C_ONE) {
      r = r * b2 % m3;
    }
  }
  return r;
}
function cycleLen(n, d2) {
  for (; d2 % C_TWO === C_ZERO; d2 /= C_TWO) {
  }
  for (; d2 % C_FIVE === C_ZERO; d2 /= C_FIVE) {
  }
  if (d2 === C_ONE)
    return C_ZERO;
  let rem = C_TEN % d2;
  let t = 1;
  for (; rem !== C_ONE; t++) {
    rem = rem * C_TEN % d2;
    if (t > MAX_CYCLE_LEN)
      return C_ZERO;
  }
  return BigInt(t);
}
function cycleStart(n, d2, len) {
  let rem1 = C_ONE;
  let rem2 = modpow(C_TEN, len, d2);
  for (let t = 0; t < 300; t++) {
    if (rem1 === rem2)
      return BigInt(t);
    rem1 = rem1 * C_TEN % d2;
    rem2 = rem2 * C_TEN % d2;
  }
  return 0;
}
function gcd(a, b2) {
  if (!a)
    return b2;
  if (!b2)
    return a;
  while (1) {
    a %= b2;
    if (!a)
      return b2;
    b2 %= a;
    if (!b2)
      return a;
  }
}
function Fraction(a, b2) {
  parse(a, b2);
  if (this instanceof Fraction) {
    a = gcd(P["d"], P["n"]);
    this["s"] = P["s"];
    this["n"] = P["n"] / a;
    this["d"] = P["d"] / a;
  } else {
    return newFraction(P["s"] * P["n"], P["d"]);
  }
}
var DivisionByZero = function() {
  return new Error("Division by Zero");
};
var InvalidParameter = function() {
  return new Error("Invalid argument");
};
var NonIntegerParameter = function() {
  return new Error("Parameters must be integer");
};
Fraction.prototype = {
  "s": C_ONE,
  "n": C_ZERO,
  "d": C_ONE,
  /**
   * Calculates the absolute value
   *
   * Ex: new Fraction(-4).abs() => 4
   **/
  "abs": function() {
    return newFraction(this["n"], this["d"]);
  },
  /**
   * Inverts the sign of the current fraction
   *
   * Ex: new Fraction(-4).neg() => 4
   **/
  "neg": function() {
    return newFraction(-this["s"] * this["n"], this["d"]);
  },
  /**
   * Adds two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
   **/
  "add": function(a, b2) {
    parse(a, b2);
    return newFraction(
      this["s"] * this["n"] * P["d"] + P["s"] * this["d"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Subtracts two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
   **/
  "sub": function(a, b2) {
    parse(a, b2);
    return newFraction(
      this["s"] * this["n"] * P["d"] - P["s"] * this["d"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Multiplies two rational numbers
   *
   * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
   **/
  "mul": function(a, b2) {
    parse(a, b2);
    return newFraction(
      this["s"] * P["s"] * this["n"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Divides two rational numbers
   *
   * Ex: new Fraction("-17.(345)").inverse().div(3)
   **/
  "div": function(a, b2) {
    parse(a, b2);
    return newFraction(
      this["s"] * P["s"] * this["n"] * P["d"],
      this["d"] * P["n"]
    );
  },
  /**
   * Clones the actual object
   *
   * Ex: new Fraction("-17.(345)").clone()
   **/
  "clone": function() {
    return newFraction(this["s"] * this["n"], this["d"]);
  },
  /**
   * Calculates the modulo of two rational numbers - a more precise fmod
   *
   * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
   * Ex: new Fraction(20, 10).mod().equals(0) ? "is Integer"
   **/
  "mod": function(a, b2) {
    if (a === void 0) {
      return newFraction(this["s"] * this["n"] % this["d"], C_ONE);
    }
    parse(a, b2);
    if (C_ZERO === P["n"] * this["d"]) {
      throw DivisionByZero();
    }
    return newFraction(
      this["s"] * (P["d"] * this["n"]) % (P["n"] * this["d"]),
      P["d"] * this["d"]
    );
  },
  /**
   * Calculates the fractional gcd of two rational numbers
   *
   * Ex: new Fraction(5,8).gcd(3,7) => 1/56
   */
  "gcd": function(a, b2) {
    parse(a, b2);
    return newFraction(gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]), P["d"] * this["d"]);
  },
  /**
   * Calculates the fractional lcm of two rational numbers
   *
   * Ex: new Fraction(5,8).lcm(3,7) => 15
   */
  "lcm": function(a, b2) {
    parse(a, b2);
    if (P["n"] === C_ZERO && this["n"] === C_ZERO) {
      return newFraction(C_ZERO, C_ONE);
    }
    return newFraction(P["n"] * this["n"], gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]));
  },
  /**
   * Gets the inverse of the fraction, means numerator and denominator are exchanged
   *
   * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
   **/
  "inverse": function() {
    return newFraction(this["s"] * this["d"], this["n"]);
  },
  /**
   * Calculates the fraction to some integer exponent
   *
   * Ex: new Fraction(-1,2).pow(-3) => -8
   */
  "pow": function(a, b2) {
    parse(a, b2);
    if (P["d"] === C_ONE) {
      if (P["s"] < C_ZERO) {
        return newFraction((this["s"] * this["d"]) ** P["n"], this["n"] ** P["n"]);
      } else {
        return newFraction((this["s"] * this["n"]) ** P["n"], this["d"] ** P["n"]);
      }
    }
    if (this["s"] < C_ZERO) return null;
    let N3 = factorize(this["n"]);
    let D2 = factorize(this["d"]);
    let n = C_ONE;
    let d2 = C_ONE;
    for (let k2 in N3) {
      if (k2 === "1") continue;
      if (k2 === "0") {
        n = C_ZERO;
        break;
      }
      N3[k2] *= P["n"];
      if (N3[k2] % P["d"] === C_ZERO) {
        N3[k2] /= P["d"];
      } else return null;
      n *= BigInt(k2) ** N3[k2];
    }
    for (let k2 in D2) {
      if (k2 === "1") continue;
      D2[k2] *= P["n"];
      if (D2[k2] % P["d"] === C_ZERO) {
        D2[k2] /= P["d"];
      } else return null;
      d2 *= BigInt(k2) ** D2[k2];
    }
    if (P["s"] < C_ZERO) {
      return newFraction(d2, n);
    }
    return newFraction(n, d2);
  },
  /**
   * Calculates the logarithm of a fraction to a given rational base
   *
   * Ex: new Fraction(27, 8).log(9, 4) => 3/2
   */
  "log": function(a, b2) {
    parse(a, b2);
    if (this["s"] <= C_ZERO || P["s"] <= C_ZERO) return null;
    const allPrimes = /* @__PURE__ */ Object.create(null);
    const baseFactors = factorize(P["n"]);
    const T1 = factorize(P["d"]);
    const numberFactors = factorize(this["n"]);
    const T2 = factorize(this["d"]);
    for (const prime in T1) {
      baseFactors[prime] = (baseFactors[prime] || C_ZERO) - T1[prime];
    }
    for (const prime in T2) {
      numberFactors[prime] = (numberFactors[prime] || C_ZERO) - T2[prime];
    }
    for (const prime in baseFactors) {
      if (prime === "1") continue;
      allPrimes[prime] = true;
    }
    for (const prime in numberFactors) {
      if (prime === "1") continue;
      allPrimes[prime] = true;
    }
    let retN = null;
    let retD = null;
    for (const prime in allPrimes) {
      const baseExponent = baseFactors[prime] || C_ZERO;
      const numberExponent = numberFactors[prime] || C_ZERO;
      if (baseExponent === C_ZERO) {
        if (numberExponent !== C_ZERO) {
          return null;
        }
        continue;
      }
      let curN = numberExponent;
      let curD = baseExponent;
      const gcdValue = gcd(curN, curD);
      curN /= gcdValue;
      curD /= gcdValue;
      if (retN === null && retD === null) {
        retN = curN;
        retD = curD;
      } else if (curN * retD !== retN * curD) {
        return null;
      }
    }
    return retN !== null && retD !== null ? newFraction(retN, retD) : null;
  },
  /**
   * Check if two rational numbers are the same
   *
   * Ex: new Fraction(19.6).equals([98, 5]);
   **/
  "equals": function(a, b2) {
    parse(a, b2);
    return this["s"] * this["n"] * P["d"] === P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is less than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "lt": function(a, b2) {
    parse(a, b2);
    return this["s"] * this["n"] * P["d"] < P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is less than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "lte": function(a, b2) {
    parse(a, b2);
    return this["s"] * this["n"] * P["d"] <= P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is greater than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "gt": function(a, b2) {
    parse(a, b2);
    return this["s"] * this["n"] * P["d"] > P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is greater than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "gte": function(a, b2) {
    parse(a, b2);
    return this["s"] * this["n"] * P["d"] >= P["s"] * P["n"] * this["d"];
  },
  /**
   * Compare two rational numbers
   * < 0 iff this < that
   * > 0 iff this > that
   * = 0 iff this = that
   *
   * Ex: new Fraction(19.6).compare([98, 5]);
   **/
  "compare": function(a, b2) {
    parse(a, b2);
    let t = this["s"] * this["n"] * P["d"] - P["s"] * P["n"] * this["d"];
    return (C_ZERO < t) - (t < C_ZERO);
  },
  /**
   * Calculates the ceil of a rational number
   *
   * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
   **/
  "ceil": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) + (places * this["n"] % this["d"] > C_ZERO && this["s"] >= C_ZERO ? C_ONE : C_ZERO),
      places
    );
  },
  /**
   * Calculates the floor of a rational number
   *
   * Ex: new Fraction('4.(3)').floor() => (4 / 1)
   **/
  "floor": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) - (places * this["n"] % this["d"] > C_ZERO && this["s"] < C_ZERO ? C_ONE : C_ZERO),
      places
    );
  },
  /**
   * Rounds a rational numbers
   *
   * Ex: new Fraction('4.(3)').round() => (4 / 1)
   **/
  "round": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) + this["s"] * ((this["s"] >= C_ZERO ? C_ONE : C_ZERO) + C_TWO * (places * this["n"] % this["d"]) > this["d"] ? C_ONE : C_ZERO),
      places
    );
  },
  /**
    * Rounds a rational number to a multiple of another rational number
    *
    * Ex: new Fraction('0.9').roundTo("1/8") => 7 / 8
    **/
  "roundTo": function(a, b2) {
    parse(a, b2);
    const n = this["n"] * P["d"];
    const d2 = this["d"] * P["n"];
    const r = n % d2;
    let k2 = ifloor(n / d2);
    if (r + r >= d2) {
      k2++;
    }
    return newFraction(this["s"] * k2 * P["n"], P["d"]);
  },
  /**
   * Check if two rational numbers are divisible
   *
   * Ex: new Fraction(19.6).divisible(1.5);
   */
  "divisible": function(a, b2) {
    parse(a, b2);
    if (P["n"] === C_ZERO) return false;
    return this["n"] * P["d"] % (P["n"] * this["d"]) === C_ZERO;
  },
  /**
   * Returns a decimal representation of the fraction
   *
   * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
   **/
  "valueOf": function() {
    return Number(this["s"] * this["n"]) / Number(this["d"]);
  },
  /**
   * Creates a string representation of a fraction with all digits
   *
   * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
   **/
  "toString": function(dec = 15) {
    let N3 = this["n"];
    let D2 = this["d"];
    let cycLen = cycleLen(N3, D2);
    let cycOff = cycleStart(N3, D2, cycLen);
    let str = this["s"] < C_ZERO ? "-" : "";
    str += ifloor(N3 / D2);
    N3 %= D2;
    N3 *= C_TEN;
    if (N3)
      str += ".";
    if (cycLen) {
      for (let i2 = cycOff; i2--; ) {
        str += ifloor(N3 / D2);
        N3 %= D2;
        N3 *= C_TEN;
      }
      str += "(";
      for (let i2 = cycLen; i2--; ) {
        str += ifloor(N3 / D2);
        N3 %= D2;
        N3 *= C_TEN;
      }
      str += ")";
    } else {
      for (let i2 = dec; N3 && i2--; ) {
        str += ifloor(N3 / D2);
        N3 %= D2;
        N3 *= C_TEN;
      }
    }
    return str;
  },
  /**
   * Returns a string-fraction representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
   **/
  "toFraction": function(showMixed = false) {
    let n = this["n"];
    let d2 = this["d"];
    let str = this["s"] < C_ZERO ? "-" : "";
    if (d2 === C_ONE) {
      str += n;
    } else {
      const whole = ifloor(n / d2);
      if (showMixed && whole > C_ZERO) {
        str += whole;
        str += " ";
        n %= d2;
      }
      str += n;
      str += "/";
      str += d2;
    }
    return str;
  },
  /**
   * Returns a latex representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
   **/
  "toLatex": function(showMixed = false) {
    let n = this["n"];
    let d2 = this["d"];
    let str = this["s"] < C_ZERO ? "-" : "";
    if (d2 === C_ONE) {
      str += n;
    } else {
      const whole = ifloor(n / d2);
      if (showMixed && whole > C_ZERO) {
        str += whole;
        n %= d2;
      }
      str += "\\frac{";
      str += n;
      str += "}{";
      str += d2;
      str += "}";
    }
    return str;
  },
  /**
   * Returns an array of continued fraction elements
   *
   * Ex: new Fraction("7/8").toContinued() => [0,1,7]
   */
  "toContinued": function() {
    let a = this["n"];
    let b2 = this["d"];
    const res = [];
    while (b2) {
      res.push(ifloor(a / b2));
      const t = a % b2;
      a = b2;
      b2 = t;
    }
    return res;
  },
  "simplify": function(eps = 1e-3) {
    const ieps = BigInt(Math.ceil(1 / eps));
    const thisABS = this["abs"]();
    const cont = thisABS["toContinued"]();
    for (let i2 = 1; i2 < cont.length; i2++) {
      let s = newFraction(cont[i2 - 1], C_ONE);
      for (let k2 = i2 - 2; k2 >= 0; k2--) {
        s = s["inverse"]()["add"](cont[k2]);
      }
      let t = s["sub"](thisABS);
      if (t["n"] * ieps < t["d"]) {
        return s["mul"](this["s"]);
      }
    }
    return this;
  }
};

// vite-stubs/kabelsalat-web.js
var SalatRepl = class {
  constructor() {
  }
  setCode() {
  }
  evaluate() {
  }
  stop() {
  }
};

// node_modules/@strudel/core/dist/index.mjs
var oe = "strudel.log";
var Qe = 1e3;
var Ut;
var Xt;
function zt(t, e = "cyclist") {
  process.env.NODE_ENV === "development" && console.error(t), E(`[${e}] error: ${t.message}`);
}
function E(t, e, n = {}) {
  let s = performance.now();
  Ut === t && s - Xt < Qe || (Ut = t, Xt = s, console.log(`%c${t}`, "background-color: black;color:white;border-radius:15px"), typeof document < "u" && typeof CustomEvent < "u" && document.dispatchEvent(
    new CustomEvent(oe, {
      detail: {
        message: t,
        type: e,
        data: n
      }
    })
  ));
}
E.key = oe;
var Yf = (t) => /^[a-gA-G][#bsf]*[0-9]*$/.test(t);
var Mt = (t) => /^[a-gA-G][#bsf]*-?[0-9]*$/.test(t);
var Ue = (t) => {
  if (typeof t != "string")
    return [];
  const [e, n = "", s] = t.match(/^([a-gA-G])([#bsf]*)(-?[0-9]*)$/)?.slice(1) || [];
  return e ? [e, n, s ? Number(s) : void 0] : [];
};
var Xe = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
var Ke = { "#": 1, b: -1, s: 1, f: -1 };
var Ye = (t) => t?.split("").reduce((e, n) => e + Ke[n], 0) || 0;
var gt = (t, e = 3) => {
  const [n, s, r = e] = Ue(t);
  if (!n)
    throw new Error('not a note: "' + t + '"');
  const o = Xe[n.toLowerCase()], i2 = Ye(s);
  return (Number(r) + 1) * 12 + o + i2;
};
var it = (t) => Math.pow(2, (t - 69) / 12) * 440;
var Ze = (t) => 12 * Math.log(t / 440) / Math.LN2 + 69;
var Zf = (t, e) => {
  if (typeof t != "object")
    throw new Error("valueToMidi: expected object value");
  let { freq: n, note: s } = t;
  if (typeof n == "number")
    return Ze(n);
  if (typeof s == "string")
    return gt(s);
  if (typeof s == "number")
    return s;
  if (!e)
    throw new Error("valueToMidi: expected freq or note to be set");
  return e;
};
var th = (t, e) => (t - e) * 1e3;
var tn = (t) => it(typeof t == "number" ? t : gt(t));
var en = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var eh = (t) => {
  const e = Math.floor(t / 12) - 1;
  return en[t % 12] + e;
};
var bt = (t, e) => (t % e + e) % e;
var nn = (t) => t.reduce((e, n) => e + n) / t.length;
function sn(t, e = 0) {
  return isNaN(Number(t)) ? (E(`"${t}" is not a number, falling back to ${e}`, "warning"), e) : t;
}
var nh = (t, e) => bt(Math.round(sn(t ?? 0, 0)), e);
var sh = (t) => {
  let { value: e, context: n } = t, s = e;
  if (typeof s == "object" && !Array.isArray(s) && (s = s.note || s.n || s.value, s === void 0))
    throw new Error(`cannot find a playable note for ${JSON.stringify(e)}`);
  if (typeof s == "number" && n.type !== "frequency")
    s = it(t.value);
  else if (typeof s == "number" && n.type === "frequency")
    s = t.value;
  else if (typeof s != "string" || !Mt(s))
    throw new Error("not a note: " + JSON.stringify(s));
  return s;
};
var rh = (t) => {
  let { value: e, context: n } = t;
  if (typeof e == "object")
    return e.freq ? e.freq : tn(e.note || e.n || e.value);
  if (typeof e == "number" && n.type !== "frequency")
    e = it(t.value);
  else if (typeof e == "string" && Mt(e))
    e = it(gt(t.value));
  else if (typeof e != "number")
    throw new Error("not a note or frequency: " + e);
  return e;
};
var rn = (t, e) => t.slice(e).concat(t.slice(0, e));
var on = (...t) => t.reduce(
  (e, n) => (...s) => e(n(...s)),
  (e) => e
);
var oh = (...t) => on(...t.reverse());
var lt = (t) => t.filter((e) => e != null);
var G = (t) => [].concat(...t);
var ot = (t) => t;
var ch = (t, e) => t;
var _t = (t, e) => Array.from({ length: e - t + 1 }, (n, s) => s + t);
function w(t, e, n = t.length) {
  const s = function r(...o) {
    if (o.length >= n)
      return t.apply(this, o);
    {
      const i2 = function(...a) {
        return r.apply(this, o.concat(a));
      };
      return e && e(i2, o), i2;
    }
  };
  return e && e(s, []), s;
}
function ce(t) {
  const e = Number(t);
  if (!isNaN(e))
    return e;
  if (Mt(t))
    return gt(t);
  throw new Error(`cannot parse as numeral: "${t}"`);
}
function ie(t, e) {
  return (...n) => t(...n.map(e));
}
function L(t) {
  return ie(t, ce);
}
function cn(t) {
  const e = Number(t);
  if (!isNaN(e))
    return e;
  const n = {
    pi: Math.PI,
    w: 1,
    h: 0.5,
    q: 0.25,
    e: 0.125,
    s: 0.0625,
    t: 1 / 3,
    f: 0.2,
    x: 1 / 6
  }[t];
  if (typeof n < "u")
    return n;
  throw new Error(`cannot parse as fractional: "${t}"`);
}
var ih = (t) => ie(t, cn);
var ue = function(t, e) {
  return [e.slice(0, t), e.slice(t)];
};
var Pt = (t, e, n) => e.map((s, r) => t(s, n[r]));
var un = function(t) {
  const e = [];
  for (let n = 0; n < t.length - 1; ++n)
    e.push([t[n], t[n + 1]]);
  return e;
};
var an = (t, e, n) => Math.min(Math.max(t, e), n);
var ln = ["Do", "Reb", "Re", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"];
var pn = [
  "Sa",
  "Re",
  "Ga",
  "Ma",
  "Pa",
  "Dha",
  "Ni"
];
var fn = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Hb", "H"];
var hn = [
  "Ni",
  "Pab",
  "Pa",
  "Voub",
  "Vou",
  "Ga",
  "Dib",
  "Di",
  "Keb",
  "Ke",
  "Zob",
  "Zo"
];
var dn = [
  "I",
  "Ro",
  "Ha",
  "Ni",
  "Ho",
  "He",
  "To"
];
var mn = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var uh = (t, e = "letters") => {
  const s = (e === "solfeggio" ? ln : e === "indian" ? pn : e === "german" ? fn : e === "byzantine" ? hn : e === "japanese" ? dn : mn)[t % 12], r = Math.floor(t / 12) - 1;
  return s + r;
};
function ah(t) {
  var e = {};
  return t.filter(function(n) {
    return e.hasOwn(n) ? false : e[n] = true;
  });
}
function lh(t) {
  return t.sort().filter(function(e, n, s) {
    return !n || e != s[n - 1];
  });
}
function yn(t) {
  return t.sort((e, n) => e.compare(n)).filter(function(e, n, s) {
    return !n || e.ne(s[n - 1]);
  });
}
function wn(t) {
  const e = new TextEncoder().encode(t);
  return btoa(String.fromCharCode(...e));
}
function gn(t) {
  const e = new Uint8Array(
    atob(t).split("").map((s) => s.charCodeAt(0))
  );
  return new TextDecoder().decode(e);
}
function ph(t) {
  return encodeURIComponent(wn(t));
}
function fh(t) {
  return gn(decodeURIComponent(t));
}
function bn(t, e) {
  return Array.isArray(t) ? t.map(e) : Object.fromEntries(Object.entries(t).map(([n, s], r) => [n, e(s, n, r)]));
}
function Kt(t, e) {
  return t / e;
}
var _n = class {
  constructor({
    getTargetClockTime: e = vn,
    weight: n = 16,
    offsetDelta: s = 5e-3,
    checkAfterTime: r = 2,
    resetAfterTime: o = 8
  }) {
    this.offsetTime, this.timeAtPrevOffsetSample, this.prevOffsetTimes = [], this.getTargetClockTime = e, this.weight = n, this.offsetDelta = s, this.checkAfterTime = r, this.resetAfterTime = o, this.reset = () => {
      this.prevOffsetTimes = [], this.offsetTime = null, this.timeAtPrevOffsetSample = null;
    };
  }
  calculateOffset(e) {
    const n = this.getTargetClockTime(), s = n - this.timeAtPrevOffsetSample, r = n - e;
    if (s > this.resetAfterTime && this.reset(), this.offsetTime == null && (this.offsetTime = r), this.prevOffsetTimes.push(r), this.prevOffsetTimes.length > this.weight && this.prevOffsetTimes.shift(), this.timeAtPrevOffsetSample == null || s > this.checkAfterTime) {
      this.timeAtPrevOffsetSample = n;
      const o = nn(this.prevOffsetTimes);
      Math.abs(o - this.offsetTime) > this.offsetDelta && (this.offsetTime = o);
    }
    return this.offsetTime;
  }
  calculateTimestamp(e, n) {
    return this.calculateOffset(e) + n;
  }
};
function hh() {
  return performance.now() * 1e-3;
}
function vn() {
  return Date.now() * 1e-3;
}
var kn = /* @__PURE__ */ new Map([
  ["control", "Control"],
  ["ctrl", "Control"],
  ["alt", "Alt"],
  ["shift", "Shift"],
  ["down", "ArrowDown"],
  ["up", "ArrowUp"],
  ["left", "ArrowLeft"],
  ["right", "ArrowRight"]
]);
var rt;
function qn() {
  if (rt == null) {
    if (typeof window > "u")
      return;
    rt = {}, window.addEventListener("keydown", (t) => {
      rt[t.key] = true;
    }), window.addEventListener("keyup", (t) => {
      rt[t.key] = false;
    });
  }
  return { ...rt };
}
function ae(t, e = false) {
  return typeof t == "object" ? e ? JSON.stringify(t).slice(1, -1).replaceAll('"', "").replaceAll(",", " ") : JSON.stringify(t) : t;
}
Fraction.prototype.sam = function() {
  return this.floor();
};
Fraction.prototype.nextSam = function() {
  return this.sam().add(1);
};
Fraction.prototype.wholeCycle = function() {
  return new B(this.sam(), this.nextSam());
};
Fraction.prototype.cyclePos = function() {
  return this.sub(this.sam());
};
Fraction.prototype.lt = function(t) {
  return this.compare(t) < 0;
};
Fraction.prototype.gt = function(t) {
  return this.compare(t) > 0;
};
Fraction.prototype.lte = function(t) {
  return this.compare(t) <= 0;
};
Fraction.prototype.gte = function(t) {
  return this.compare(t) >= 0;
};
Fraction.prototype.eq = function(t) {
  return this.compare(t) == 0;
};
Fraction.prototype.ne = function(t) {
  return this.compare(t) != 0;
};
Fraction.prototype.max = function(t) {
  return this.gt(t) ? this : t;
};
Fraction.prototype.maximum = function(...t) {
  return t = t.map((e) => new Fraction(e)), t.reduce((e, n) => n.max(e), this);
};
Fraction.prototype.min = function(t) {
  return this.lt(t) ? this : t;
};
Fraction.prototype.mulmaybe = function(t) {
  return t !== void 0 ? this.mul(t) : void 0;
};
Fraction.prototype.divmaybe = function(t) {
  return t !== void 0 ? this.div(t) : void 0;
};
Fraction.prototype.addmaybe = function(t) {
  return t !== void 0 ? this.add(t) : void 0;
};
Fraction.prototype.submaybe = function(t) {
  return t !== void 0 ? this.sub(t) : void 0;
};
Fraction.prototype.show = function() {
  return this.s * this.n + "/" + this.d;
};
Fraction.prototype.or = function(t) {
  return this.eq(0) ? t : this;
};
var m = (t) => Fraction(t);
var Sn = (...t) => {
  if (t = lt(t), t.length !== 0)
    return t.reduce((e, n) => e.gcd(n), m(1));
};
var Y = (...t) => {
  if (t = lt(t), t.length === 0)
    return;
  const e = t.pop();
  return t.reduce(
    (n, s) => n === void 0 || s === void 0 ? void 0 : n.lcm(s),
    e
  );
};
var An = (t) => t instanceof Fraction;
m._original = Fraction;
var B = class _B {
  constructor(e, n) {
    this.begin = m(e), this.end = m(n);
  }
  get spanCycles() {
    const e = [];
    var n = this.begin;
    const s = this.end, r = s.sam();
    if (n.equals(s))
      return [new _B(n, s)];
    for (; s.gt(n); ) {
      if (n.sam().equals(r)) {
        e.push(new _B(n, this.end));
        break;
      }
      const o = n.nextSam();
      e.push(new _B(n, o)), n = o;
    }
    return e;
  }
  get duration() {
    return this.end.sub(this.begin);
  }
  cycleArc() {
    const e = this.begin.cyclePos(), n = e.add(this.duration);
    return new _B(e, n);
  }
  withTime(e) {
    return new _B(e(this.begin), e(this.end));
  }
  withEnd(e) {
    return new _B(this.begin, e(this.end));
  }
  withCycle(e) {
    const n = this.begin.sam(), s = n.add(e(this.begin.sub(n))), r = n.add(e(this.end.sub(n)));
    return new _B(s, r);
  }
  intersection(e) {
    const n = this.begin.max(e.begin), s = this.end.min(e.end);
    if (!n.gt(s) && !(n.equals(s) && (n.equals(this.end) && this.begin.lt(this.end) || n.equals(e.end) && e.begin.lt(e.end))))
      return new _B(n, s);
  }
  intersection_e(e) {
    const n = this.intersection(e);
    if (n == null)
      throw "TimeSpans do not intersect";
    return n;
  }
  midpoint() {
    return this.begin.add(this.duration.div(m(2)));
  }
  equals(e) {
    return this.begin.equals(e.begin) && this.end.equals(e.end);
  }
  show() {
    return this.begin.show() + " \u2192 " + this.end.show();
  }
};
var S = class _S {
  /*
        Event class, representing a value active during the timespan
        'part'. This might be a fragment of an event, in which case the
        timespan will be smaller than the 'whole' timespan, otherwise the
        two timespans will be the same. The 'part' must never extend outside of the
        'whole'. If the event represents a continuously changing value
        then the whole will be returned as None, in which case the given
        value will have been sampled from the point halfway between the
        start and end of the 'part' timespan.
        The context is to store a list of source code locations causing the event.
  
        The word 'Event' is more or less a reserved word in javascript, hence this
        class is named called 'Hap'.
        */
  constructor(e, n, s, r = {}, o = false) {
    this.whole = e, this.part = n, this.value = s, this.context = r, this.stateful = o, o && console.assert(typeof this.value == "function", "Stateful values must be functions");
  }
  get duration() {
    let e;
    return typeof this.value?.duration == "number" ? e = m(this.value.duration) : e = this.whole.end.sub(this.whole.begin), typeof this.value?.clip == "number" ? e.mul(this.value.clip) : e;
  }
  get endClipped() {
    return this.whole.begin.add(this.duration);
  }
  isActive(e) {
    return this.whole.begin <= e && this.endClipped >= e;
  }
  isInPast(e) {
    return e > this.endClipped;
  }
  isInNearPast(e, n) {
    return n - e <= this.endClipped;
  }
  isInFuture(e) {
    return e < this.whole.begin;
  }
  isInNearFuture(e, n) {
    return n < this.whole.begin && n > this.whole.begin - e;
  }
  isWithinTime(e, n) {
    return this.whole.begin <= n && this.endClipped >= e;
  }
  wholeOrPart() {
    return this.whole ? this.whole : this.part;
  }
  withSpan(e) {
    const n = this.whole ? e(this.whole) : void 0;
    return new _S(n, e(this.part), this.value, this.context);
  }
  withValue(e) {
    return new _S(this.whole, this.part, e(this.value), this.context);
  }
  hasOnset() {
    return this.whole != null && this.whole.begin.equals(this.part.begin);
  }
  hasTag(e) {
    return this.context.tags?.includes(e);
  }
  resolveState(e) {
    if (this.stateful && this.hasOnset()) {
      console.log("stateful");
      const n = this.value, [s, r] = n(e);
      return [s, new _S(this.whole, this.part, r, this.context, false)];
    }
    return [e, this];
  }
  spanEquals(e) {
    return this.whole == null && e.whole == null || this.whole.equals(e.whole);
  }
  equals(e) {
    return this.spanEquals(e) && this.part.equals(e.part) && // TODO would == be better ??
    this.value === e.value;
  }
  show(e = false) {
    const n = typeof this.value == "object" ? e ? JSON.stringify(this.value).slice(1, -1).replaceAll('"', "").replaceAll(",", " ") : JSON.stringify(this.value) : this.value;
    var s = "";
    if (this.whole == null)
      s = "~" + this.part.show;
    else {
      var r = this.whole.begin.equals(this.part.begin) && this.whole.end.equals(this.part.end);
      this.whole.begin.equals(this.part.begin) || (s = this.whole.begin.show() + " \u21DC "), r || (s += "("), s += this.part.show(), r || (s += ")"), this.whole.end.equals(this.part.end) || (s += " \u21DD " + this.whole.end.show());
    }
    return "[ " + s + " | " + n + " ]";
  }
  showWhole(e = false) {
    return `${this.whole == null ? "~" : this.whole.show()}: ${ae(this.value, e)}`;
  }
  combineContext(e) {
    const n = this;
    return { ...n.context, ...e.context, locations: (n.context.locations || []).concat(e.context.locations || []) };
  }
  setContext(e) {
    return new _S(this.whole, this.part, this.value, e);
  }
  ensureObjectValue() {
    if (typeof this.value != "object")
      throw new Error(
        `expected hap.value to be an object, but got "${this.value}". Hint: append .note() or .s() to the end`,
        "error"
      );
  }
};
var ut = class _ut {
  constructor(e, n = {}) {
    this.span = e, this.controls = n;
  }
  // Returns new State with different span
  setSpan(e) {
    return new _ut(e, this.controls);
  }
  withSpan(e) {
    return this.setSpan(e(this.span));
  }
  // Returns new State with added controls.
  setControls(e) {
    return new _ut(this.span, { ...this.controls, ...e });
  }
};
function Tn(t, e, n) {
  if (e?.value !== void 0 && Object.keys(e).length === 1)
    return E("[warn]: Can't do arithmetic on control pattern."), t;
  const s = Object.keys(t).filter((r) => Object.keys(e).includes(r));
  return Object.assign({}, t, e, Object.fromEntries(s.map((r) => [r, n(t[r], e[r])])));
}
w((t, e) => t * e);
w((t, e) => e.map(t));
function Cn(t, e = 60) {
  let n = 0, s = m(0), r = [""], o = "";
  for (; r[0].length < e; ) {
    const i2 = t.queryArc(n, n + 1), a = i2.filter((h) => h.hasOnset()).map((h) => h.duration), u = Sn(...a), p = u.inverse();
    r = r.map((h) => h + "|"), o += "|";
    for (let h = 0; h < p; h++) {
      const [y, g] = [s, s.add(u)], v = i2.filter((O) => O.whole.begin.lte(y) && O.whole.end.gte(g)), _2 = v.length - r.length;
      _2 > 0 && (r = r.concat(Array(_2).fill(o))), r = r.map((O, A3) => {
        const I3 = v[A3];
        if (I3) {
          const P3 = I3.whole.begin.eq(y) ? "" + I3.value : "-";
          return O + P3;
        }
        return O + ".";
      }), o += ".", s = s.add(u);
    }
    n++;
  }
  return r.join(`
`);
}
var le = {};
var xn = async (...t) => {
  const e = await Promise.allSettled(t), n = e.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return e.forEach((s, r) => {
    s.status === "rejected" && console.warn(`evalScope: module with index ${r} could not be loaded:`, s.reason);
  }), n.forEach((s) => {
    Object.entries(s).forEach(([r, o]) => {
      globalThis[r] = o, le[r] = o;
    });
  }), n;
};
function Bn(t, e = {}) {
  const { wrapExpression: n = true, wrapAsync: s = true } = e;
  n && (t = `{${t}}`), s && (t = `(async ()=>${t})()`);
  const r = `"use strict";return (${t})`;
  return Function(r)();
}
var On = async (t, e, n) => {
  let s = {};
  if (e) {
    const i2 = e(t, n);
    t = i2.output, s = i2;
  }
  return { mode: "javascript", pattern: await Bn(t, { wrapExpression: !!e }), meta: s };
};
var Ct;
var J = true;
var dh = function(t) {
  J = !!t;
};
var mh = (t) => Ct = t;
var f = class _f2 {
  /**
   * Create a pattern. As an end user, you will most likely not create a Pattern directly.
   *
   * @param {function} query - The function that maps a `State` to an array of `Hap`.
   * @noAutocomplete
   */
  constructor(e, n = void 0) {
    this.query = e, this._Pattern = true, this._steps = n;
  }
  get _steps() {
    return this.__steps;
  }
  set _steps(e) {
    this.__steps = e === void 0 ? void 0 : m(e);
  }
  setSteps(e) {
    return this._steps = e, this;
  }
  withSteps(e) {
    return J ? new _f2(this.query, this._steps === void 0 ? void 0 : e(this._steps)) : this;
  }
  get hasSteps() {
    return this._steps !== void 0;
  }
  //////////////////////////////////////////////////////////////////////
  // Haskell-style functor, applicative and monadic operations
  /**
   * Returns a new pattern, with the function applied to the value of
   * each hap. It has the alias `fmap`.
   * @synonyms fmap
   * @param {Function} func to to apply to the value
   * @returns Pattern
   * @example
   * "0 1 2".withValue(v => v + 10).log()
   */
  withValue(e) {
    const n = new _f2((s) => this.query(s).map((r) => r.withValue(e)));
    return n._steps = this._steps, n;
  }
  // runs func on query state
  withState(e) {
    return new _f2((n) => this.query(e(n)));
  }
  /**
   * see `withValue`
   * @noAutocomplete
   */
  fmap(e) {
    return this.withValue(e);
  }
  /**
   * Assumes 'this' is a pattern of functions, and given a function to
   * resolve wholes, applies a given pattern of values to that
   * pattern of functions.
   * @param {Function} whole_func
   * @param {Function} func
   * @noAutocomplete
   * @returns Pattern
   */
  appWhole(e, n) {
    const s = this, r = function(o) {
      const i2 = s.query(o), a = n.query(o), u = function(p, h) {
        const y = p.part.intersection(h.part);
        if (y != null)
          return new S(
            e(p.whole, h.whole),
            y,
            p.value(h.value),
            h.combineContext(p)
          );
      };
      return G(
        i2.map((p) => lt(a.map((h) => u(p, h))))
      );
    };
    return new _f2(r);
  }
  /**
   * When this method is called on a pattern of functions, it matches its haps
   * with those in the given pattern of values.  A new pattern is returned, with
   * each matching value applied to the corresponding function.
   *
   * In this `_appBoth` variant, where timespans of the function and value haps
   * are not the same but do intersect, the resulting hap has a timespan of the
   * intersection. This applies to both the part and the whole timespan.
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appBoth(e) {
    const n = this, s = function(o, i2) {
      if (!(o == null || i2 == null))
        return o.intersection_e(i2);
    }, r = n.appWhole(s, e);
    return J && (r._steps = Y(e._steps, n._steps)), r;
  }
  /**
   * As with `appBoth`, but the `whole` timespan is not the intersection,
   * but the timespan from the function of patterns that this method is called
   * on. In practice, this means that the pattern structure, including onsets,
   * are preserved from the pattern of functions (often referred to as the left
   * hand or inner pattern).
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appLeft(e) {
    const n = this, s = function(o) {
      const i2 = [];
      for (const a of n.query(o)) {
        const u = e.query(o.setSpan(a.wholeOrPart()));
        for (const p of u) {
          const h = a.whole, y = a.part.intersection(p.part);
          if (y) {
            const g = a.value(p.value), v = p.combineContext(a), _2 = new S(h, y, g, v);
            i2.push(_2);
          }
        }
      }
      return i2;
    }, r = new _f2(s);
    return r._steps = this._steps, r;
  }
  /**
   * As with `appLeft`, but `whole` timespans are instead taken from the
   * pattern of values, i.e. structure is preserved from the right hand/outer
   * pattern.
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appRight(e) {
    const n = this, s = function(o) {
      const i2 = [];
      for (const a of e.query(o)) {
        const u = n.query(o.setSpan(a.wholeOrPart()));
        for (const p of u) {
          const h = a.whole, y = p.part.intersection(a.part);
          if (y) {
            const g = p.value(a.value), v = a.combineContext(p), _2 = new S(h, y, g, v);
            i2.push(_2);
          }
        }
      }
      return i2;
    }, r = new _f2(s);
    return r._steps = e._steps, r;
  }
  bindWhole(e, n) {
    const s = this, r = function(o) {
      const i2 = function(u, p) {
        return new S(
          e(u.whole, p.whole),
          p.part,
          p.value,
          Object.assign({}, u.context, p.context, {
            locations: (u.context.locations || []).concat(p.context.locations || [])
          })
        );
      }, a = function(u) {
        return n(u.value).query(o.setSpan(u.part)).map((p) => i2(u, p));
      };
      return G(s.query(o).map((u) => a(u)));
    };
    return new _f2(r);
  }
  bind(e) {
    const n = function(s, r) {
      if (!(s == null || r == null))
        return s.intersection_e(r);
    };
    return this.bindWhole(n, e);
  }
  join() {
    return this.bind(ot);
  }
  outerBind(e) {
    return this.bindWhole((n) => n, e).setSteps(this._steps);
  }
  outerJoin() {
    return this.outerBind(ot);
  }
  innerBind(e) {
    return this.bindWhole((n, s) => s, e);
  }
  innerJoin() {
    return this.innerBind(ot);
  }
  // Flatterns patterns of patterns, by retriggering/resetting inner patterns at onsets of outer pattern haps
  resetJoin(e = false) {
    const n = this;
    return new _f2((s) => n.discreteOnly().query(s).map((r) => r.value.late(e ? r.whole.begin : r.whole.begin.cyclePos()).query(s).map(
      (o) => new S(
        // Supports continuous haps in the inner pattern
        o.whole ? o.whole.intersection(r.whole) : void 0,
        o.part.intersection(r.part),
        o.value
      ).setContext(r.combineContext(o))
    ).filter((o) => o.part)).flat());
  }
  restartJoin() {
    return this.resetJoin(true);
  }
  // Like the other joins above, joins a pattern of patterns of values, into a flatter
  // pattern of values. In this case it takes whole cycles of the inner pattern to fit each event
  // in the outer pattern.
  squeezeJoin() {
    const e = this;
    function n(s) {
      const r = e.discreteOnly().query(s);
      function o(a) {
        const p = a.value._focusSpan(a.wholeOrPart()).query(s.setSpan(a.part));
        function h(y, g) {
          let v;
          if (g.whole && y.whole && (v = g.whole.intersection(y.whole), !v))
            return;
          const _2 = g.part.intersection(y.part);
          if (!_2)
            return;
          const O = g.combineContext(y);
          return new S(v, _2, g.value, O);
        }
        return p.map((y) => h(a, y));
      }
      return G(r.map(o)).filter((a) => a);
    }
    return new _f2(n);
  }
  squeezeBind(e) {
    return this.fmap(e).squeezeJoin();
  }
  polyJoin = function() {
    const e = this;
    return e.fmap((n) => n.extend(e._steps.div(n._steps))).outerJoin();
  };
  polyBind(e) {
    return this.fmap(e).polyJoin();
  }
  //////////////////////////////////////////////////////////////////////
  // Utility methods mainly for internal use
  /**
   * Query haps inside the given time span.
   *
   * @param {Fraction | number} begin from time
   * @param {Fraction | number} end to time
   * @returns Hap[]
   * @example
   * const pattern = sequence('a', ['b', 'c'])
   * const haps = pattern.queryArc(0, 1)
   * console.log(haps)
   * silence
   * @noAutocomplete
   */
  queryArc(e, n, s = {}) {
    try {
      return this.query(new ut(new B(e, n), s));
    } catch (r) {
      return zt(r, "query"), [];
    }
  }
  /**
   * Returns a new pattern, with queries split at cycle boundaries. This makes
   * some calculations easier to express, as all haps are then constrained to
   * happen within a cycle.
   * @returns Pattern
   * @noAutocomplete
   */
  splitQueries() {
    const e = this, n = (s) => G(s.span.spanCycles.map((r) => e.query(s.setSpan(r))));
    return new _f2(n);
  }
  /**
   * Returns a new pattern, where the given function is applied to the query
   * timespan before passing it to the original pattern.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withQuerySpan(e) {
    return new _f2((n) => this.query(n.withSpan(e)));
  }
  withQuerySpanMaybe(e) {
    const n = this;
    return new _f2((s) => {
      const r = s.withSpan(e);
      return r.span ? n.query(r) : [];
    });
  }
  /**
   * As with `withQuerySpan`, but the function is applied to both the
   * begin and end time of the query timespan.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withQueryTime(e) {
    return new _f2((n) => this.query(n.withSpan((s) => s.withTime(e))));
  }
  /**
   * Similar to `withQuerySpan`, but the function is applied to the timespans
   * of all haps returned by pattern queries (both `part` timespans, and where
   * present, `whole` timespans).
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHapSpan(e) {
    return new _f2((n) => this.query(n).map((s) => s.withSpan(e)));
  }
  /**
   * As with `withHapSpan`, but the function is applied to both the
   * begin and end time of the hap timespans.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withHapTime(e) {
    return this.withHapSpan((n) => n.withTime(e));
  }
  /**
   * Returns a new pattern with the given function applied to the list of haps returned by every query.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHaps(e) {
    const n = new _f2((s) => e(this.query(s), s));
    return n._steps = this._steps, n;
  }
  /**
   * As with `withHaps`, but applies the function to every hap, rather than every list of haps.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHap(e) {
    return this.withHaps((n) => n.map(e));
  }
  /**
   * Returns a new pattern with the context field set to every hap set to the given value.
   * @param {*} context
   * @returns Pattern
   * @noAutocomplete
   */
  setContext(e) {
    return this.withHap((n) => n.setContext(e));
  }
  /**
   * Returns a new pattern with the given function applied to the context field of every hap.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withContext(e) {
    const n = this.withHap((s) => s.setContext(e(s.context)));
    return this.__pure !== void 0 && (n.__pure = this.__pure, n.__pure_loc = this.__pure_loc), n;
  }
  /**
   * Returns a new pattern with the context field of every hap set to an empty object.
   * @returns Pattern
   * @noAutocomplete
   */
  stripContext() {
    return this.withHap((e) => e.setContext({}));
  }
  /**
   * Returns a new pattern with the given location information added to the
   * context of every hap.
   * @param {Number} start start offset
   * @param {Number} end end offset
   * @returns Pattern
   * @noAutocomplete
   */
  withLoc(e, n) {
    const s = {
      start: e,
      end: n
    }, r = this.withContext((o) => {
      const i2 = (o.locations || []).concat([s]);
      return { ...o, locations: i2 };
    });
    return this.__pure && (r.__pure = this.__pure, r.__pure_loc = s), r;
  }
  /**
   * Returns a new Pattern, which only returns haps that meet the given test.
   * @param {Function} hap_test - a function which returns false for haps to be removed from the pattern
   * @returns Pattern
   * @example
   * s("bd*8").velocity(rand).filterHaps((h) => (h.whole.begin % 1) < h.value.velocity)
   */
  filterHaps(e) {
    return new _f2((n) => this.query(n).filter(e));
  }
  /**
   * As with `filterHaps`, but the function is applied to values
   * inside haps.
   * @param {Function} value_test
   * @returns Pattern
   * @example
   * const drums = s("bd sd bd sd")
   * kick: drums.filterValues((v) => v.s === 'bd').duck(2)
   * snare: drums.filterValues((v) => v.s === 'sd')
   * bass: s("saw!4").note("G#1").lpf(80).lpenv(4).orbit(2)
   */
  filterValues(e) {
    return new _f2((n) => this.query(n).filter((s) => e(s.value))).setSteps(this._steps);
  }
  /**
   * Returns a new pattern, with haps containing undefined values removed from
   * query results.
   * @returns Pattern
   * @noAutocomplete
   */
  removeUndefineds() {
    return this.filterValues((e) => e != null);
  }
  /**
   * Returns a new pattern, with all haps without onsets filtered out. A hap
   * with an onset is one with a `whole` timespan that begins at the same time
   * as its `part` timespan.
   * @returns Pattern
   * @noAutocomplete
   */
  onsetsOnly() {
    return this.filterHaps((e) => e.hasOnset());
  }
  /**
   * Returns a new pattern, with 'continuous' haps (those without 'whole'
   * timespans) removed from query results.
   * @returns Pattern
   * @noAutocomplete
   */
  discreteOnly() {
    return this.filterHaps((e) => e.whole);
  }
  /**
   * Combines adjacent haps with the same value and whole.  Only
   * intended for use in tests.
   * @noAutocomplete
   */
  defragmentHaps() {
    return this.discreteOnly().withHaps((n) => {
      const s = [];
      for (var r = 0; r < n.length; ++r) {
        for (var o = true, i2 = n[r]; o; ) {
          const p = JSON.stringify(n[r].value);
          for (var a = false, u = r + 1; u < n.length; u++) {
            const h = n[u];
            if (i2.whole.equals(h.whole)) {
              if (i2.part.begin.eq(h.part.end)) {
                if (p === JSON.stringify(h.value)) {
                  i2 = new S(i2.whole, new B(h.part.begin, i2.part.end), i2.value), n.splice(u, 1), a = true;
                  break;
                }
              } else if (h.part.begin.eq(i2.part.end) && p == JSON.stringify(h.value)) {
                i2 = new S(i2.whole, new B(i2.part.begin, h.part.end), i2.value), n.splice(u, 1), a = true;
                break;
              }
            }
          }
          o = a;
        }
        s.push(i2);
      }
      return s;
    });
  }
  /**
   * Queries the pattern for the first cycle, returning Haps. Mainly of use when
   * debugging a pattern.
   * @param {Boolean} with_context - set to true, otherwise the context field
   * will be stripped from the resulting haps.
   * @returns [Hap]
   * @noAutocomplete
   */
  firstCycle(e = false) {
    var n = this;
    return e || (n = n.stripContext()), n.query(new ut(new B(m(0), m(1))));
  }
  /**
   * Accessor for a list of values returned by querying the first cycle.
   * @noAutocomplete
   */
  get firstCycleValues() {
    return this.firstCycle().map((e) => e.value);
  }
  /**
   * More human-readable version of the `firstCycleValues` accessor.
   * @noAutocomplete
   */
  get showFirstCycle() {
    return this.firstCycle().map(
      (e) => `${e.value}: ${e.whole.begin.toFraction()} - ${e.whole.end.toFraction()}`
    );
  }
  /**
   * Returns a new pattern, which returns haps sorted in temporal order. Mainly
   * of use when comparing two patterns for equality, in tests.
   * @returns Pattern
   * @noAutocomplete
   */
  sortHapsByPart() {
    return this.withHaps(
      (e) => e.sort(
        (n, s) => n.part.begin.sub(s.part.begin).or(n.part.end.sub(s.part.end)).or(n.whole.begin.sub(s.whole.begin).or(n.whole.end.sub(s.whole.end)))
      )
    );
  }
  asNumber() {
    return this.fmap(ce);
  }
  //////////////////////////////////////////////////////////////////////
  // Operators - see 'make composers' later..
  _opIn(e, n) {
    return this.fmap(n).appLeft(d(e));
  }
  _opOut(e, n) {
    return this.fmap(n).appRight(d(e));
  }
  _opMix(e, n) {
    return this.fmap(n).appBoth(d(e));
  }
  _opSqueeze(e, n) {
    const s = d(e);
    return this.fmap((r) => s.fmap((o) => n(r)(o))).squeezeJoin();
  }
  _opSqueezeOut(e, n) {
    const s = this;
    return d(e).fmap((o) => s.fmap((i2) => n(i2)(o))).squeezeJoin();
  }
  _opReset(e, n) {
    return d(e).fmap((r) => this.fmap((o) => n(o)(r))).resetJoin();
  }
  _opRestart(e, n) {
    return d(e).fmap((r) => this.fmap((o) => n(o)(r))).restartJoin();
  }
  _opPoly(e, n) {
    const s = d(e);
    return this.fmap((r) => s.fmap((o) => n(o)(r))).polyJoin();
  }
  //////////////////////////////////////////////////////////////////////
  // End-user methods.
  // Those beginning with an underscore (_) are 'patternified',
  // i.e. versions are created without the underscore, that are
  // magically transformed to accept patterns for all their arguments.
  //////////////////////////////////////////////////////////////////////
  // Methods without corresponding toplevel functions
  /**
   * Layers the result of the given function(s). Like `superimpose`, but without the original pattern:
   * @name layer
   * @memberof Pattern
   * @synonyms apply
   * @returns Pattern
   * @example
   * "<0 2 4 6 ~ 4 ~ 2 0!3 ~!5>*8"
   *   .layer(x=>x.add("0,2"))
   *   .scale('C minor').note()
   */
  layer(...e) {
    return z(...e.map((n) => n(this)));
  }
  /**
   * Superimposes the result of the given function(s) on top of the original pattern:
   * @name superimpose
   * @memberof Pattern
   * @returns Pattern
   * @example
   * "<0 2 4 6 ~ 4 ~ 2 0!3 ~!5>*8"
   *   .superimpose(x=>x.add(2))
   *   .scale('C minor').note()
   */
  superimpose(...e) {
    return this.stack(...e.map((n) => n(this)));
  }
  //////////////////////////////////////////////////////////////////////
  // Multi-pattern functions
  stack(...e) {
    return z(this, ...e);
  }
  sequence(...e) {
    return Q(this, ...e);
  }
  seq(...e) {
    return Q(this, ...e);
  }
  cat(...e) {
    return mt(this, ...e);
  }
  fastcat(...e) {
    return N(this, ...e);
  }
  slowcat(...e) {
    return Z(this, ...e);
  }
  //////////////////////////////////////////////////////////////////////
  // Context methods - ones that deal with metadata
  onTrigger(e, n = true) {
    return this.withHap(
      (s) => s.setContext({
        ...s.context,
        onTrigger: (...r) => {
          s.context.onTrigger?.(...r), e(...r);
        },
        // if dominantTrigger is set to true, the default output (webaudio) will be disabled
        // when using multiple triggers, you cannot flip this flag to false again!
        // example: x.csound('CooLSynth').log() as well as x.log().csound('CooLSynth') should work the same
        dominantTrigger: s.context.dominantTrigger || n
      })
    );
  }
  /**
   * Writes the content of the current event to the console (visible in the side menu).
   * @name log
   * @memberof Pattern
   * @example
   * s("bd sd").log()
   */
  log(e = (s) => `[hap] ${s.showWhole(true)}`, n = (s) => ({ hap: s })) {
    return this.onTrigger((...s) => {
      E(e(...s), void 0, n(...s));
    }, false);
  }
  /**
   * A simplified version of `log` which writes all "values" (various configurable parameters)
   * within the event to the console (visible in the side menu).
   * @name logValues
   * @memberof Pattern
   * @example
   * s("bd sd").gain("0.25 0.5 1").n("2 1 0").logValues()
   */
  logValues(e = (n) => `[hap] ${ae(n, true)}`) {
    return this.log((n) => e(n.value));
  }
  //////////////////////////////////////////////////////////////////////
  // Visualisation
  drawLine() {
    return console.log(Cn(this)), this;
  }
  //////////////////////////////////////////////////////////////////////
  // methods relating to breaking patterns into subcycles
  // Breaks a pattern into a pattern of patterns, according to the structure of the given binary pattern.
  unjoin(e, n = ot) {
    return e.withHap(
      (s) => s.withValue((r) => r ? n(this.ribbon(s.whole.begin, s.whole.duration)) : this)
    );
  }
  /**
   * Breaks a pattern into pieces according to the structure of a given pattern.
   * True values in the given pattern cause the corresponding subcycle of the
   * source pattern to be looped, and for an (optional) given function to be
   * applied. False values result in the corresponding part of the source pattern
   * to be played unchanged.
   * @name into
   * @memberof Pattern
   * @example
   * sound("bd sd ht lt").into("1 0", hurry(2))
   */
  into(e, n) {
    return this.unjoin(e, n).innerJoin();
  }
};
function zn(t, e) {
  let n = [];
  return e.forEach((s) => {
    const r = n.findIndex(([o]) => t(s, o));
    r === -1 ? n.push([s]) : n[r].push(s);
  }), n;
}
var Mn = (t, e) => t.spanEquals(e);
f.prototype.collect = function() {
  return this.withHaps(
    (t) => zn(Mn, t).map((e) => new S(e[0].whole, e[0].part, e, {}))
  );
};
var yh = l("arpWith", (t, e) => e.collect().fmap((n) => d(t(n))).innerJoin().withHap((n) => new S(n.whole, n.part, n.value.value, n.combineContext(n.value))));
var wh = l(
  "arp",
  (t, e) => e.arpWith((n) => d(t).fmap((s) => n[s % n.length])),
  false
);
function dt(t) {
  return !Array.isArray(t) && typeof t == "object" && !An(t);
}
function Pn(t, e, n) {
  return dt(t) || dt(e) ? (dt(t) || (t = { value: t }), dt(e) || (e = { value: e }), Tn(t, e, n)) : n(t, e);
}
(function() {
  const t = {
    set: [(n, s) => s],
    keep: [(n) => n],
    keepif: [(n, s) => s ? n : void 0],
    // numerical functions
    /**
     *
     * Assumes a pattern of numbers. Adds the given number to each item in the pattern.
     * @name add
     * @memberof Pattern
     * @example
     * // Here, the triad 0, 2, 4 is shifted by different amounts
     * n("0 2 4".add("<0 3 4 0>")).scale("C:major")
     * // Without add, the equivalent would be:
     * // n("<[0 2 4] [3 5 7] [4 6 8] [0 2 4]>").scale("C:major")
     * @example
     * // You can also use add with notes:
     * note("c3 e3 g3".add("<0 5 7 0>"))
     * // Behind the scenes, the notes are converted to midi numbers:
     * // note("48 52 55".add("<0 5 7 0>"))
     */
    add: [L((n, s) => n + s)],
    // support string concatenation
    /**
     *
     * Like add, but the given numbers are subtracted.
     * @name sub
     * @memberof Pattern
     * @example
     * n("0 2 4".sub("<0 1 2 3>")).scale("C4:minor")
     * // See add for more information.
     */
    sub: [L((n, s) => n - s)],
    /**
     *
     * Multiplies each number by the given factor.
     * @name mul
     * @memberof Pattern
     * @example
     * "<1 1.5 [1.66, <2 2.33>]>*4".mul(150).freq()
     */
    mul: [L((n, s) => n * s)],
    /**
     *
     * Divides each number by the given factor.
     * @name div
     * @memberof Pattern
     */
    div: [L((n, s) => n / s)],
    mod: [L(bt)],
    pow: [L(Math.pow)],
    log2: [L(Math.log2)],
    band: [L((n, s) => n & s)],
    bor: [L((n, s) => n | s)],
    bxor: [L((n, s) => n ^ s)],
    blshift: [L((n, s) => n << s)],
    brshift: [L((n, s) => n >> s)],
    // TODO - force numerical comparison if both look like numbers?
    lt: [(n, s) => n < s],
    gt: [(n, s) => n > s],
    lte: [(n, s) => n <= s],
    gte: [(n, s) => n >= s],
    eq: [(n, s) => n == s],
    eqt: [(n, s) => n === s],
    ne: [(n, s) => n != s],
    net: [(n, s) => n !== s],
    and: [(n, s) => n && s],
    or: [(n, s) => n || s],
    //  bitwise ops
    func: [(n, s) => s(n)]
  }, e = ["In", "Out", "Mix", "Squeeze", "SqueezeOut", "Reset", "Restart", "Poly"];
  for (const [n, [s, r]] of Object.entries(t)) {
    f.prototype["_" + n] = function(o) {
      return this.fmap((i2) => s(i2, o));
    }, Object.defineProperty(f.prototype, n, {
      // a getter that returns a function, so 'pat' can be
      // accessed by closures that are methods of that function..
      get: function() {
        const o = this, i2 = (...a) => o[n].in(...a);
        for (const a of e)
          i2[a.toLowerCase()] = function(...u) {
            var p = o;
            u = Q(u), r && (p = r(p), u = r(u));
            var h;
            return n === "keepif" ? (h = p["_op" + a](u, (y) => (g) => s(y, g)), h = h.removeUndefineds()) : h = p["_op" + a](u, (y) => (g) => Pn(y, g, s)), h;
          };
        return i2.squeezein = i2.squeeze, i2;
      }
    });
    for (const o of e)
      f.prototype[o.toLowerCase()] = function(...i2) {
        return this.set[o.toLowerCase()](i2);
      };
  }
  f.prototype.struct = function(...n) {
    return this.keepif.out(...n);
  }, f.prototype.structAll = function(...n) {
    return this.keep.out(...n);
  }, f.prototype.mask = function(...n) {
    return this.keepif.in(...n);
  }, f.prototype.maskAll = function(...n) {
    return this.keep.in(...n);
  }, f.prototype.reset = function(...n) {
    return this.keepif.reset(...n);
  }, f.prototype.resetAll = function(...n) {
    return this.keep.reset(...n);
  }, f.prototype.restart = function(...n) {
    return this.keepif.restart(...n);
  }, f.prototype.restartAll = function(...n) {
    return this.keep.restart(...n);
  };
})();
var gh = z;
var bh = z;
var _h = $t;
var pt = (t) => new f(() => [], t);
var q = pt(1);
var R = pt(0);
function C(t) {
  function e(s) {
    return s.span.spanCycles.map((r) => new S(m(r.begin).wholeCycle(), r, t));
  }
  const n = new f(e, 1);
  return n.__pure = t, n;
}
function pe(t) {
  return t instanceof f || t?._Pattern;
}
function d(t) {
  return pe(t) ? t : Ct && typeof t == "string" ? Ct(t) : C(t);
}
function En(t) {
  let e = C([]);
  for (const n of t)
    e = e.bind((s) => n.fmap((r) => s.concat([r])));
  return e;
}
function z(...t) {
  t = t.map((s) => Array.isArray(s) ? Q(...s) : d(s));
  const e = (s) => G(t.map((r) => r.query(s))), n = new f(e);
  return J && (n._steps = Y(...t.map((s) => s._steps))), n;
}
function Et(t, e) {
  if (e = e.map((o) => Array.isArray(o) ? Q(...o) : d(o)), e.length === 0)
    return q;
  if (e.length === 1)
    return e[0];
  const [n, ...s] = e.map((o) => o._steps), r = J ? n.maximum(...s) : void 0;
  return z(...t(r, e));
}
function jn(...t) {
  return Et(
    (e, n) => n.map((s) => s._steps.eq(e) ? s : $(s, pt(e.sub(s._steps)))),
    t
  );
}
function Jn(...t) {
  return Et(
    (e, n) => n.map((s) => s._steps.eq(e) ? s : $(pt(e.sub(s._steps)), s)),
    t
  );
}
function $n(...t) {
  return Et(
    (e, n) => n.map((s) => {
      if (s._steps.eq(e))
        return s;
      const r = pt(e.sub(s._steps).div(2));
      return $(r, s, r);
    }),
    t
  );
}
function vh(t, ...e) {
  const [n, ...s] = e.map((i2) => i2._steps), r = n.maximum(...s), o = {
    centre: $n,
    left: jn,
    right: Jn,
    expand: z,
    repeat: (...i2) => $t(...i2).steps(r)
  };
  return t.inhabit(o).fmap((i2) => i2(...e)).innerJoin().setSteps(r);
}
function Z(...t) {
  if (t = t.map((s) => Array.isArray(s) ? N(...s) : d(s)), t.length == 1)
    return t[0];
  const e = function(s) {
    const r = s.span, o = bt(r.begin.sam(), t.length), i2 = t[o];
    if (!i2)
      return [];
    const a = r.begin.floor().sub(r.begin.div(t.length).floor());
    return i2.withHapTime((u) => u.add(a)).query(s.setSpan(r.withTime((u) => u.sub(a))));
  }, n = J ? Y(...t.map((s) => s._steps)) : void 0;
  return new f(e).splitQueries().setSteps(n);
}
function fe(...t) {
  t = t.map(d);
  const e = function(n) {
    const s = Math.floor(n.span.begin) % t.length;
    return t[s]?.query(n) || [];
  };
  return new f(e).splitQueries();
}
function mt(...t) {
  return Z(...t);
}
function kh(...t) {
  const e = t.reduce((n, [s]) => n + s, 0);
  return t = t.map(([n, s]) => [n, s.fast(n)]), $(...t).slow(e);
}
function qh(...t) {
  let e = m(0);
  for (let n of t)
    n.length == 2 && n.unshift(e), e = n[1];
  return z(
    ...t.map(
      ([n, s, r]) => C(d(r)).compress(m(n).div(e), m(s).div(e))
    )
  ).slow(e).innerJoin();
}
function N(...t) {
  let e = Z(...t);
  return t.length > 1 && (e = e._fast(t.length), e._steps = t.length), t.length == 1 && t[0].__steps_source && (t._steps = t[0]._steps), e;
}
function Q(...t) {
  return N(...t);
}
function Nn(...t) {
  return N(...t);
}
function xt(t) {
  return Array.isArray(t) ? t.length == 0 ? [q, 0] : t.length == 1 ? xt(t[0]) : [N(...t.map((e) => xt(e)[0])), t.length] : [d(t), 1];
}
var Sh = w((t, e) => d(e).mask(t));
var Ah = w((t, e) => d(e).struct(t));
var Th = w((t, e) => d(e).superimpose(...t));
var Ch = w((t, e) => d(e).withValue(t));
var xh = w((t, e) => d(e).bind(t));
var Bh = w((t, e) => d(e).innerBind(t));
var Oh = w((t, e) => d(e).outerBind(t));
var zh = w((t, e) => d(e).squeezeBind(t));
var Mh = w((t, e) => d(e).stepBind(t));
var Ph = w((t, e) => d(e).polyBind(t));
var Eh = w((t, e) => d(e).set(t));
var jh = w((t, e) => d(e).keep(t));
var Jh = w((t, e) => d(e).keepif(t));
var $h = w((t, e) => d(e).add(t));
var Nh = w((t, e) => d(e).sub(t));
var Lh = w((t, e) => d(e).mul(t));
var Rh = w((t, e) => d(e).div(t));
var Wh = w((t, e) => d(e).mod(t));
var Fh = w((t, e) => d(e).pow(t));
var Ih = w((t, e) => d(e).band(t));
var Vh = w((t, e) => d(e).bor(t));
var Hh = w((t, e) => d(e).bxor(t));
var Dh = w((t, e) => d(e).blshift(t));
var Gh = w((t, e) => d(e).brshift(t));
var Qh = w((t, e) => d(e).lt(t));
var Uh = w((t, e) => d(e).gt(t));
var Xh = w((t, e) => d(e).lte(t));
var Kh = w((t, e) => d(e).gte(t));
var Yh = w((t, e) => d(e).eq(t));
var Zh = w((t, e) => d(e).eqt(t));
var td = w((t, e) => d(e).ne(t));
var ed = w((t, e) => d(e).net(t));
var nd = w((t, e) => d(e).and(t));
var sd = w((t, e) => d(e).or(t));
var rd = w((t, e) => d(e).func(t));
function l(t, e, n = true, s = false, r = (o) => o.innerJoin()) {
  if (Array.isArray(t)) {
    const u = {};
    for (const p of t)
      u[p] = l(p, e, n, s, r);
    return u;
  }
  const o = e.length;
  var i2;
  n ? i2 = function(...u) {
    u = u.map(d);
    const p = u[u.length - 1];
    let h;
    if (o === 1)
      h = e(p);
    else {
      const y = u.slice(0, -1);
      if (y.every((g) => g.__pure != null)) {
        const g = y.map((_2) => _2.__pure), v = y.filter((_2) => _2.__pure_loc).map((_2) => _2.__pure_loc);
        h = e(...g, p), h = h.withContext((_2) => {
          const O = (_2.locations || []).concat(v);
          return { ..._2, locations: O };
        });
      } else {
        const [g, ...v] = y;
        let _2 = (...O) => e(...O, p);
        _2 = w(_2, null, o - 1), h = r(v.reduce((O, A3) => O.appLeft(A3), g.fmap(_2)));
      }
    }
    return s && (h._steps = p._steps), h;
  } : i2 = function(...u) {
    u = u.map(d);
    const p = e(...u);
    return s && (p._steps = u[u.length - 1]._steps), p;
  }, f.prototype[t] = function(...u) {
    if (o === 2 && u.length !== 1)
      u = [Q(...u)];
    else if (o !== u.length + 1)
      throw new Error(`.${t}() expects ${o - 1} inputs but got ${u.length}.`);
    return u = u.map(d), i2(...u, this);
  }, o > 1 && (f.prototype["_" + t] = function(...u) {
    const p = e(...u, this);
    return s && p.setSteps(this._steps), p;
  });
  const a = w(i2, null, o);
  return le[t] = a, a;
}
function et(t, e, n = true, s = false, r = (o) => o.stepJoin()) {
  return l(t, e, n, s, r);
}
var od = l("round", function(t) {
  return t.asNumber().fmap((e) => Math.round(e));
});
var cd = l("floor", function(t) {
  return t.asNumber().fmap((e) => Math.floor(e));
});
var id = l("ceil", function(t) {
  return t.asNumber().fmap((e) => Math.ceil(e));
});
var ud = l("toBipolar", function(t) {
  return t.fmap((e) => e * 2 - 1);
});
var ad = l("fromBipolar", function(t) {
  return t.fmap((e) => (e + 1) / 2);
});
var ld = l("range", function(t, e, n) {
  return n.mul(e - t).add(t);
});
var pd = l("rangex", function(t, e, n) {
  return n._range(Math.log(t), Math.log(e)).fmap(Math.exp);
});
var fd = l("range2", function(t, e, n) {
  return n.fromBipolar()._range(t, e);
});
var hd = l(
  "ratio",
  (t) => t.fmap((e) => Array.isArray(e) ? e.slice(1).reduce((n, s) => n / s, e[0]) : e)
);
var dd = l("compress", function(t, e, n) {
  return t = m(t), e = m(e), t.gt(e) || t.gt(1) || e.gt(1) || t.lt(0) || e.lt(0) ? q : n._fastGap(m(1).div(e.sub(t)))._late(t);
});
var { compressSpan: md, compressspan: yd } = l(["compressSpan", "compressspan"], function(t, e) {
  return e._compress(t.begin, t.end);
});
var { fastGap: wd, fastgap: gd } = l(["fastGap", "fastgap"], function(t, e) {
  const n = function(r) {
    const o = r.begin.sam(), i2 = r.begin.sub(o).mul(t).min(1), a = r.end.sub(o).mul(t).min(1);
    if (!(i2 >= 1))
      return new B(o.add(i2), o.add(a));
  }, s = function(r) {
    const o = r.part.begin, i2 = r.part.end, a = o.sam(), u = o.sub(a).div(t).min(1), p = i2.sub(a).div(t).min(1), h = new B(a.add(u), a.add(p)), y = r.whole ? new B(
      h.begin.sub(o.sub(r.whole.begin).div(t)),
      h.end.add(r.whole.end.sub(i2).div(t))
    ) : void 0;
    return new S(y, h, r.value, r.context);
  };
  return e.withQuerySpanMaybe(n).withHap(s).splitQueries();
});
var bd = l("focus", function(t, e, n) {
  return t = m(t), e = m(e), n._early(t.sam())._fast(m(1).div(e.sub(t)))._late(t);
});
var { focusSpan: _d, focusspan: vd } = l(["focusSpan", "focusspan"], function(t, e) {
  return e._focus(t.begin, t.end);
});
var kd = l("ply", function(t, e) {
  const n = e.fmap((s) => C(s)._fast(t)).squeezeJoin();
  return J && (n._steps = m(t).mulmaybe(e._steps)), n;
});
var { fast: qd, density: Sd } = l(
  ["fast", "density"],
  function(t, e) {
    return t === 0 ? q : (t = m(t), e.withQueryTime((s) => s.mul(t)).withHapTime((s) => s.div(t)).setSteps(e._steps));
  },
  true,
  true
);
var Ad = l("hurry", function(t, e) {
  return e._fast(t).mul(C({ speed: t }));
});
var { slow: Td, sparsity: Cd } = l(["slow", "sparsity"], function(t, e) {
  return t === 0 ? q : e._fast(m(1).div(t));
});
var xd = l("inside", function(t, e, n) {
  return e(n._slow(t))._fast(t);
});
var Bd = l("outside", function(t, e, n) {
  return e(n._fast(t))._slow(t);
});
var Od = l("lastOf", function(t, e, n) {
  const s = Array(t - 1).fill(n);
  return s.push(e(n)), fe(...s);
});
var { firstOf: zd, every: Md } = l(["firstOf", "every"], function(t, e, n) {
  const s = Array(t - 1).fill(n);
  return s.unshift(e(n)), fe(...s);
});
var Pd = l("apply", function(t, e) {
  return t(e);
});
var Ed = l("cpm", function(t, e) {
  return e._fast(t / 60 / 1);
});
var jd = l(
  "early",
  function(t, e) {
    return t = m(t), e.withQueryTime((n) => n.add(t)).withHapTime((n) => n.sub(t));
  },
  true,
  true
);
var Ln = l(
  "late",
  function(t, e) {
    return t = m(t), e._early(m(0).sub(t));
  },
  true,
  true
);
var Jd = l("zoom", function(t, e, n) {
  if (e = m(e), t = m(t), t.gte(e))
    return R;
  const s = e.sub(t), r = J ? n._steps?.mulmaybe(s) : void 0;
  return n.withQuerySpan((o) => o.withCycle((i2) => i2.mul(s).add(t))).withHapSpan((o) => o.withCycle((i2) => i2.sub(t).div(s))).splitQueries().setSteps(r);
});
var { zoomArc: $d, zoomarc: Nd } = l(["zoomArc", "zoomarc"], function(t, e) {
  return e.zoom(t.begin, t.end);
});
var Ld = l(
  "bite",
  (t, e, n) => e.fmap((s) => (r) => {
    const o = m(s).div(r).mod(1), i2 = o.add(m(1).div(r));
    return n.zoom(o, i2);
  }).appLeft(t).squeezeJoin(),
  false
);
var Rd = l(
  "linger",
  function(t, e) {
    return t == 0 ? q : t < 0 ? e._zoom(t.add(1), 1)._slow(t) : e._zoom(0, t)._slow(t);
  },
  true,
  true
);
var { segment: Wd, seg: Fd } = l(["segment", "seg"], function(t, e) {
  return e.struct(C(true)._fast(t)).setSteps(t);
});
var Id = l("swingBy", (t, e, n) => n.inside(e, Ln(Nn(0, t / 2))));
var Vd = l("swing", (t, e) => e.swingBy(1 / 3, t));
var { invert: Hd, inv: Dd } = l(
  ["invert", "inv"],
  function(t) {
    return t.fmap((e) => !e);
  },
  true,
  true
);
var Gd = l("when", function(t, e, n) {
  return t ? e(n) : n;
});
var Qd = l("off", function(t, e, n) {
  return z(n, e(n.late(t)));
});
var Ud = l("brak", function(t) {
  return t.when(Z(false, true), (e) => N(e, q)._late(0.25));
});
var Rn = l(
  "rev",
  function(t) {
    const e = function(n) {
      const s = n.span, r = s.begin.sam(), o = s.begin.nextSam(), i2 = function(u) {
        const p = u.withTime((y) => r.add(o.sub(y))), h = p.begin;
        return p.begin = p.end, p.end = h, p;
      };
      return t.query(n.setSpan(i2(s))).map((u) => u.withSpan(i2));
    };
    return new f(e).splitQueries();
  },
  false,
  true
);
var Xd = l("revv", function(t) {
  const e = (n) => new B(m(0).sub(n.end), m(0).sub(n.begin));
  return t.withQuerySpan(e).withHapSpan(e);
});
var Kd = l("pressBy", function(t, e) {
  return e.fmap((n) => C(n).compress(t, 1)).squeezeJoin();
});
var Yd = l("press", function(t) {
  return t._pressBy(0.5);
});
f.prototype.hush = function() {
  return q;
};
var Zd = l(
  "palindrome",
  function(t) {
    return t.lastOf(2, Rn);
  },
  true,
  true
);
var { juxBy: tm, juxby: em } = l(["juxBy", "juxby"], function(t, e, n) {
  t /= 2;
  const s = function(i2, a, u) {
    return a in i2 ? i2[a] : u;
  }, r = n.withValue((i2) => Object.assign({}, i2, { pan: s(i2, "pan", 0.5) - t })), o = e(n.withValue((i2) => Object.assign({}, i2, { pan: s(i2, "pan", 0.5) + t })));
  return z(r, o).setSteps(J ? Y(r._steps, o._steps) : void 0);
});
var nm = l("jux", function(t, e) {
  return e._juxBy(1, t, e);
});
var { echoWith: sm, echowith: rm, stutWith: om, stutwith: cm } = l(
  ["echoWith", "echowith", "stutWith", "stutwith"],
  function(t, e, n, s) {
    return z(..._t(0, t - 1).map((r) => n(s.late(m(e).mul(r)), r)));
  }
);
var im = l("echo", function(t, e, n, s) {
  return s._echoWith(t, e, (r, o) => r.gain(Math.pow(n, o)));
});
var um = l("stut", function(t, e, n, s) {
  return s._echoWith(t, n, (r, o) => r.gain(Math.pow(e, o)));
});
var Wn = l("applyN", function(t, e, n) {
  let s = n;
  for (let r = 0; r < t; r++)
    s = e(s);
  return s;
});
var am = l(["plyWith", "plywith"], function(t, e, n) {
  const s = n.fmap((r) => mt(..._t(0, t - 1).map((o) => Wn(o, e, r)))._fast(t)).squeezeJoin();
  return J && (s._steps = m(t).mulmaybe(n._steps)), s;
});
var lm = l(["plyForEach", "plyforeach"], function(t, e, n) {
  const s = n.fmap((r) => mt(mt(C(r), ..._t(1, t - 1).map((o) => e(C(r), o))))._fast(t)).squeezeJoin();
  return J && (s._steps = m(t).mulmaybe(n._steps)), s;
});
var jt = function(t, e, n = false) {
  return t = m(t), Z(
    ..._t(0, t.sub(1)).map(
      (s) => n ? e.late(m(s).div(t)) : e.early(m(s).div(t))
    )
  );
};
var pm = l(
  "iter",
  function(t, e) {
    return jt(t, e, false);
  },
  true,
  true
);
var { iterBack: fm, iterback: hm } = l(
  ["iterBack", "iterback"],
  function(t, e) {
    return jt(t, e, true);
  },
  true,
  true
);
var { repeatCycles: dm } = l(
  "repeatCycles",
  function(t, e) {
    return new f(function(n) {
      const s = n.span.begin.sam(), r = s.div(t).sam(), o = s.sub(r);
      return n = n.withSpan((i2) => i2.withTime((a) => a.sub(o))), e.query(n).map((i2) => i2.withSpan((a) => a.withTime((u) => u.add(o))));
    }).splitQueries();
  },
  true,
  true
);
var Jt = function(t, e, n, s = false, r = false) {
  const o = Array(t - 1).fill(false);
  o.unshift(true);
  const i2 = jt(t, Q(...o), !s);
  return r || (n = n.repeatCycles(t)), n.when(i2, e);
};
var { chunk: mm, slowchunk: ym, slowChunk: wm } = l(
  ["chunk", "slowchunk", "slowChunk"],
  function(t, e, n) {
    return Jt(t, e, n, false, false);
  },
  true,
  true
);
var { chunkBack: gm, chunkback: bm } = l(
  ["chunkBack", "chunkback"],
  function(t, e, n) {
    return Jt(t, e, n, true);
  },
  true,
  true
);
var { fastchunk: _m, fastChunk: vm } = l(
  ["fastchunk", "fastChunk"],
  function(t, e, n) {
    return Jt(t, e, n, false, true);
  },
  true,
  true
);
var { chunkinto: km, chunkInto: qm } = l(["chunkinto", "chunkInto"], function(t, e, n) {
  return n.into(N(true, ...Array(t - 1).fill(false))._iterback(t), e);
});
var { chunkbackinto: Sm, chunkBackInto: Am } = l(["chunkbackinto", "chunkBackInto"], function(t, e, n) {
  return n.into(
    N(true, ...Array(t - 1).fill(false))._iter(t)._early(1),
    e
  );
});
var Tm = l(
  "bypass",
  function(t, e) {
    return t = !!parseInt(t), t ? q : e;
  },
  true,
  true
);
var { ribbon: Cm, rib: xm } = l(
  ["ribbon", "rib"],
  (t, e, n) => n.early(t).restart(C(1).slow(e))
);
var Bm = l("hsla", (t, e, n, s, r) => r.color(`hsla(${t}turn,${e * 100}%,${n * 100}%,${s})`));
var Om = l("hsl", (t, e, n, s) => s.color(`hsl(${t}turn,${e * 100}%,${n * 100}%)`));
f.prototype.tag = function(t) {
  return this.withContext((e) => ({ ...e, tags: (e.tags || []).concat([t]) }));
};
var zm = l("filter", (t, e) => e.withHaps((n) => n.filter(t)));
var Mm = l("filterWhen", (t, e) => e.filter((n) => t(n.whole.begin)));
var Pm = l(
  "within",
  (t, e, n, s) => z(
    n(s.filterWhen((r) => r.cyclePos() >= t && r.cyclePos() <= e)),
    s.filterWhen((r) => r.cyclePos() < t || r.cyclePos() > e)
  )
);
f.prototype.stepJoin = function() {
  const t = this, e = $(...Yt(Zt(t.queryArc(0, 1))))._steps, n = function(s) {
    const o = t.early(s.span.begin.sam()).query(s.setSpan(new B(m(0), m(1))));
    return $(...Yt(Zt(o))).query(s);
  };
  return new f(n, e);
};
f.prototype.stepBind = function(t) {
  return this.fmap(t).stepJoin();
};
function Yt(t) {
  const e = t.filter((o, i2) => i2.hasSteps).reduce((o, i2) => o.add(i2), m(0)), n = lt(t.map((o, i2) => i2._steps)).reduce(
    (o, i2) => o.add(i2),
    m(0)
  ), s = e.eq(0) ? void 0 : n.div(e);
  function r(o, i2) {
    return i2._steps === void 0 ? [o.mulmaybe(s), i2] : [i2._steps, i2];
  }
  return t.map((o) => r(...o));
}
function Zt(t) {
  const e = G(t.map((r) => [r.part.begin, r.part.end])), n = yn([m(0), m(1), ...e]);
  return un(n).map((r) => [
    r[1].sub(r[0]),
    z(...Fn(new B(...r), t).map((o) => o.value.withHap((i2) => i2.setContext(i2.combineContext(o)))))
  ]);
}
function Fn(t, e) {
  return lt(e.map((n) => In(t, n)));
}
function In(t, e) {
  const n = t.intersection(e.part);
  if (n != null)
    return new S(e.whole, n, e.value, e.context);
}
var Vn = l("pace", function(t, e) {
  return e._steps === void 0 ? e : e._steps.eq(m(0)) ? R : e._fast(m(t).div(e._steps)).setSteps(t);
});
function Hn(t, ...e) {
  const n = e.map((r) => xt(r));
  if (n.length == 0)
    return q;
  t == 0 && (t = n[0][1]);
  const s = [];
  for (const r of n)
    r[1] != 0 && (t == r[1] ? s.push(r[0]) : s.push(r[0]._fast(m(t).div(m(r[1])))));
  return z(...s);
}
function $t(...t) {
  if (Array.isArray(t[0]))
    return Hn(0, ...t);
  if (t = t.filter((s) => s.hasSteps), t.length == 0)
    return q;
  const e = Y(...t.map((s) => s._steps));
  if (e.eq(m(0)))
    return R;
  const n = z(...t.map((s) => s.pace(e)));
  return n._steps = e, n;
}
function $(...t) {
  if (t.length === 0)
    return R;
  const e = (i2) => Array.isArray(i2) ? i2 : [i2._steps ?? 1, i2];
  if (t = t.map(e), t.find((i2) => i2[0] === void 0)) {
    const i2 = t.map((u) => u[0]).filter((u) => u !== void 0);
    if (i2.length === 0)
      return N(...t.map((u) => u[1]));
    if (i2.length === t.length)
      return R;
    const a = i2.reduce((u, p) => u.add(p), m(0)).div(i2.length);
    for (let u of t)
      u[0] === void 0 && (u[0] = a);
  }
  if (t.length == 1)
    return d(t[0][1]).withSteps((a) => t[0][0]);
  const n = t.map((i2) => i2[0]).reduce((i2, a) => i2.add(a), m(0));
  let s = m(0);
  const r = [];
  for (const [i2, a] of t) {
    if (m(i2).eq(0))
      continue;
    const u = s.add(i2);
    r.push(d(a)._compress(s.div(n), u.div(n))), s = u;
  }
  const o = z(...r);
  return o._steps = n, o;
}
function Dn(...t) {
  t = t.map((r) => Array.isArray(r) ? r.map(d) : [d(r)]);
  const e = Y(...t.map((r) => m(r.length)));
  let n = [];
  for (let r = 0; r < e; ++r)
    n.push(...t.map((o) => o.length == 0 ? q : o[r % o.length]));
  n = n.filter((r) => r.hasSteps && r._steps > 0);
  const s = n.reduce((r, o) => r.add(o._steps), m(0));
  return n = $(...n), n._steps = s, n;
}
var Gn = et("take", function(t, e) {
  if (!e.hasSteps || e._steps.lte(0) || (t = m(t), t.eq(0)))
    return R;
  const n = t < 0;
  n && (t = t.abs());
  const s = t.div(e._steps);
  return s.lte(0) ? R : s.gte(1) ? e : n ? e.zoom(m(1).sub(s), 1) : e.zoom(0, s);
});
var Qn = et("drop", function(t, e) {
  return e.hasSteps ? (t = m(t), t.lt(0) ? e.take(e._steps.add(t)) : e.take(m(0).sub(e._steps.sub(t)))) : R;
});
var Un = et("extend", function(t, e) {
  return e.fast(t).expand(t);
});
var Em = et("replicate", function(t, e) {
  return e.repeatCycles(t).fast(t).expand(t);
});
var Xn = et("expand", function(t, e) {
  return e.withSteps((n) => n.mul(m(t)));
});
var Kn = et("contract", function(t, e) {
  return e.withSteps((n) => n.div(m(t)));
});
f.prototype.shrinklist = function(t) {
  const e = this;
  if (!e.hasSteps)
    return [e];
  let [n, s] = Array.isArray(t) ? t : [t, e._steps];
  if (n = m(n), s === 0 || n === 0)
    return [e];
  const r = n > 0, o = [];
  if (r) {
    const i2 = m(1).div(e._steps).mul(n);
    for (let a = 0; a < s; ++a) {
      const u = i2.mul(a);
      if (u.gt(1))
        break;
      o.push([u, 1]);
    }
  } else {
    n = m(0).sub(n);
    const i2 = m(1).div(e._steps).mul(n);
    for (let a = 0; a < s; ++a) {
      const u = m(1).sub(i2.mul(a));
      if (u.lt(0))
        break;
      o.push([m(0), u]);
    }
  }
  return o.map((i2) => e.zoom(...i2));
};
var Yn = (t, e) => e.shrinklist(t);
var Zn = l(
  "shrink",
  function(t, e) {
    if (!e.hasSteps)
      return R;
    const n = e.shrinklist(t), s = $(...n);
    return s._steps = n.reduce((r, o) => r.add(o._steps), m(0)), s;
  },
  true,
  false,
  (t) => t.stepJoin()
);
var jm = l(
  "grow",
  function(t, e) {
    if (!e.hasSteps)
      return R;
    const n = e.shrinklist(m(0).sub(t));
    n.reverse();
    const s = $(...n);
    return s._steps = n.reduce((r, o) => r.add(o._steps), m(0)), s;
  },
  true,
  false,
  (t) => t.stepJoin()
);
var ts = function(t, ...e) {
  return t.tour(...e);
};
f.prototype.tour = function(...t) {
  return $(
    ...[].concat(
      ...t.map((e, n) => [...t.slice(0, t.length - n), this, ...t.slice(t.length - n)]),
      this,
      ...t
    )
  );
};
var es = function(...t) {
  t = t.filter((s) => s.hasSteps);
  const e = Z(...t.map((s) => s._slow(s._steps))), n = Y(...t.map((s) => s._steps));
  return e._fast(n).setSteps(n);
};
var Jm = $;
var ns = $;
var $m = $;
var Nm = Dn;
var Lm = $t;
f.prototype.s_polymeter = f.prototype.polymeter;
var Rm = Zn;
f.prototype.s_taper = f.prototype.shrink;
var Wm = Yn;
f.prototype.s_taperlist = f.prototype.shrinklist;
var Fm = Gn;
f.prototype.s_add = f.prototype.take;
var Im = Qn;
f.prototype.s_sub = f.prototype.drop;
var Vm = Xn;
f.prototype.s_expand = f.prototype.expand;
var Hm = Un;
f.prototype.s_extend = f.prototype.extend;
var Dm = Kn;
f.prototype.s_contract = f.prototype.contract;
var Gm = ts;
f.prototype.s_tour = f.prototype.tour;
var Qm = es;
f.prototype.s_zip = f.prototype.zip;
var Um = Vn;
f.prototype.steps = f.prototype.pace;
var Xm = l("chop", function(t, e) {
  const s = Array.from({ length: t }, (i2, a) => a).map((i2) => ({ begin: i2 / t, end: (i2 + 1) / t })), r = function(i2, a) {
    if ("begin" in i2 && "end" in i2 && i2.begin !== void 0 && i2.end !== void 0) {
      const u = i2.end - i2.begin;
      a = { begin: i2.begin + a.begin * u, end: i2.begin + a.end * u };
    }
    return Object.assign({}, i2, a);
  }, o = function(i2) {
    return Q(s.map((a) => r(i2, a)));
  };
  return e.squeezeBind(o).setSteps(J ? m(t).mulmaybe(e._steps) : void 0);
});
var Km = l("striate", function(t, e) {
  const s = Array.from({ length: t }, (o, i2) => i2).map((o) => ({ begin: o / t, end: (o + 1) / t })), r = Z(...s);
  return e.set(r)._fast(t).setSteps(J ? m(t).mulmaybe(e._steps) : void 0);
});
var he = function(t, e, n = 0.5) {
  return e.speed(1 / t * n).unit("c").slow(t);
};
var ss = l(
  "slice",
  function(t, e, n) {
    return t.innerBind(
      (s) => e.outerBind(
        (r) => n.outerBind((o) => {
          o = o instanceof Object ? o : { s: o };
          const i2 = Array.isArray(s) ? s[r] : r / s, a = Array.isArray(s) ? s[r + 1] : (r + 1) / s;
          return C({ begin: i2, end: a, _slices: s, ...o });
        })
      )
    ).setSteps(e._steps);
  },
  false
  // turns off auto-patternification
);
f.prototype.onTriggerTime = function(t) {
  return this.onTrigger((e, n, s, r) => {
    const o = r - n;
    window.setTimeout(() => {
      t(e);
    }, o * 1e3);
  }, false);
};
var Ym = l(
  "splice",
  function(t, e, n) {
    const s = ss(t, e, n);
    return new f((r) => {
      const o = r.controls._cps || 1;
      return s.query(r).map(
        (a) => a.withValue((u) => ({
          speed: o / u._slices / a.whole.duration * (u.speed || 1),
          unit: "c",
          ...u
        }))
      );
    }).setSteps(e._steps);
  },
  false
  // turns off auto-patternification
);
var { loopAt: Zm, loopat: ty } = l(["loopAt", "loopat"], function(t, e) {
  const n = e._steps ? e._steps.div(t) : void 0;
  return new f((s) => he(t, e, s.controls._cps).query(s), n);
});
var ey = l(
  "fit",
  (t) => t.withHaps(
    (e, n) => e.map(
      (s) => s.withValue((r) => {
        const o = ("end" in r ? r.end : 1) - ("begin" in r ? r.begin : 0);
        return {
          ...r,
          speed: (n.controls._cps || 1) / s.whole.duration * o,
          unit: "c"
        };
      })
    )
  )
);
var { loopAtCps: ny, loopatcps: sy } = l(["loopAtCps", "loopatcps"], function(t, e, n) {
  return he(t, n, e);
});
var ry = (t) => C(1).withValue(() => d(t())).innerJoin();
var te = (t) => t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
var rs = (t, e, n) => {
  e = d(e), t = d(t), n = d(n);
  let s = e.fmap((o) => ({ gain: te(o) })), r = e.fmap((o) => ({ gain: te(1 - o) }));
  return z(t.mul(s), n.mul(r));
};
f.prototype.xfade = function(t, e) {
  return rs(this, t, e);
};
var os = (t) => (e, n, s) => {
  e = m(e).mod(n), n = m(n);
  const r = e.div(n), o = e.add(1).div(n);
  return t(s.fmap((i2) => C(i2)._compress(r, o)));
};
var { beat: oy } = l(
  ["beat"],
  os((t) => t.innerJoin())
);
var de = (t, e, n) => {
  n = m(n);
  const s = m(1).div(t.length), r = (a) => {
    const u = [];
    for (const [p, h] of a.entries())
      h && u.push([m(p).div(a.length), h]);
    return u;
  }, o = Pt(
    ([a, u], [p, h]) => {
      const y = n.mul(p - a).add(a), g = y.add(s);
      return new B(y, g);
    },
    r(t),
    r(e)
  );
  function i2(a) {
    const u = a.span.begin.sam(), p = a.span.cycleArc(), h = [];
    for (const y of o) {
      const g = y.intersection(p);
      g !== void 0 && h.push(
        new S(
          y.withTime((v) => v.add(u)),
          g.withTime((v) => v.add(u)),
          true
        )
      );
    }
    return h;
  }
  return new f(i2).splitQueries();
};
var cy = (t, e, n) => (t = d(t), e = d(e), n = d(n), t.innerBind((s) => e.innerBind((r) => n.innerBind((o) => de(s, r, o)))));
var U = function(t) {
  const e = function(n, s) {
    const r = d(n).fmap((o) => Array.isArray(o) ? [...o, t] : [o, 1, t]);
    return s ? s.distort(r) : C({}).distort(r);
  };
  return f.prototype[t] = function(n) {
    return e(n, this);
  }, e;
};
var iy = U("soft");
var uy = U("hard");
var ay = U("cubic");
var ly = U("diode");
var py = U("asym");
var fy = U("fold");
var hy = U("sinefold");
var dy = U("chebyshev");
var me = (t) => {
  let n = C(w((...s) => s, null, t.length));
  for (const s of t) n = n.appBoth(d(s));
  return n;
};
var vt = (t) => Array.isArray(t) ? me(t) : d(t);
f.prototype.partials = function(t) {
  return this.withValue((e) => (n) => ({ ...e, partials: n })).appLeft(vt(t));
};
var my = (t) => vt(t).as("partials");
f.prototype.phases = function(t) {
  return this.withValue((e) => (n) => ({ ...e, phases: n })).appLeft(vt(t));
};
var yy = (t) => vt(t).as("phases");
f.prototype.FX = function(...t) {
  return t = t.map(d), this.withValue((e) => (n) => {
    const s = e.FX ?? [];
    return { ...e, FX: s.concat(n) };
  }).appLeft(me(t));
};
var cs = (t) => {
  let n = C(w((...s) => s, null, t.length));
  for (const s of t) n = n.appLeft(s);
  return n;
};
f.prototype.worklet = function(t, ...e) {
  return e = e.map(d), this.outerBind((n) => cs(e).withValue((s) => {
    const r = n.workletInputs ?? [];
    return { ...n, workletSrc: t, workletInputs: r.concat(s) };
  }));
};
var wy = (...t) => C({}).worklet(...t);
function Nt(t) {
  let e = Array.isArray(t);
  t = e ? t : [t];
  const n = t[0], s = (o) => {
    let i2;
    if (typeof o == "object" && o.value !== void 0 && (i2 = { ...o }, o = o.value, delete i2.value), e && Array.isArray(o)) {
      const a = i2 || {};
      return o.forEach((u, p) => {
        p < t.length && (a[t[p]] = u);
      }), a;
    } else return i2 ? (i2[n] = o, i2) : { [n]: o };
  }, r = function(o, i2) {
    return i2 ? typeof o > "u" ? i2.fmap(s) : i2.set(d(o).withValue(s)) : d(o).withValue(s);
  };
  return f.prototype[n] = function(o) {
    return r(o, this);
  }, r;
}
var at = /* @__PURE__ */ new Map();
function is(t) {
  return at.has(t);
}
function c(t, ...e) {
  const n = Array.isArray(t) ? t[0] : t;
  let s = {};
  return s[n] = Nt(t), at.set(n, n), e.forEach((r) => {
    s[r] = s[n], at.set(r, n), f.prototype[r] = f.prototype[n];
  }), s;
}
function V(t, e, ...n) {
  t = Array.isArray(t) ? t : [t];
  let s = {};
  for (let r = 1; r <= e; r++) {
    let o = [...n], i2 = [...t];
    if (r === 1) {
      const u = o.map((h) => `${h}1`), p = i2.map((h) => `${h}1`);
      o = o.concat(u).concat(p);
    } else
      o = o.map((u) => `${u}${r}`), i2 = i2.map((u) => `${u}${r}`);
    const a = c(i2, ...o);
    s = { ...s, ...a };
  }
  return s;
}
var { s: us, sound: as } = c(["s", "n", "gain"], "sound");
var { wt: ls, wavetablePosition: ps } = c("wt", "wavetablePosition");
var { wtenv: fs } = c("wtenv");
var { wtattack: hs, wtatt: ds } = c("wtattack", "wtatt");
var { wtdecay: ms, wtdec: ys } = c("wtdecay", "wtdec");
var { wtsustain: ws, wtsus: gs } = c("wtsustain", "wtsus");
var { wtrelease: bs, wtrel: _s } = c("wtrelease", "wtrel");
var { wtrate: vs } = c("wtrate");
var { wtsync: ks } = c("wtsync");
var { wtdepth: qs } = c("wtdepth");
var { wtshape: Ss } = c("wtshape");
var { wtdc: As } = c("wtdc");
var { wtskew: Ts } = c("wtskew");
var { warp: Cs, wavetableWarp: xs } = c("warp", "wavetableWarp");
var { warpattack: Bs, warpatt: Os } = c("warpattack", "warpatt");
var { warpdecay: zs, warpdec: Ms } = c("warpdecay", "warpdec");
var { warpsustain: Ps, warpsus: Es } = c("warpsustain", "warpsus");
var { warprelease: js, warprel: Js } = c("warprelease", "warprel");
var { warprate: $s } = c("warprate");
var { warpdepth: Ns } = c("warpdepth");
var { warpshape: Ls } = c("warpshape");
var { warpdc: Rs } = c("warpdc");
var { warpskew: Ws } = c("warpskew");
var { warpmode: Fs, wavetableWarpMode: Is } = c("warpmode", "wavetableWarpMode");
var { wtphaserand: Vs, wavetablePhaseRand: Hs } = c("wtphaserand", "wavetablePhaseRand");
var { warpenv: Ds } = c("warpenv");
var { warpsync: Gs } = c("warpsync");
var { source: Qs, src: Us } = c("source", "src");
var { n: Xs } = c("n");
var { note: Ks } = c(["note", "n"]);
var { accelerate: Ys } = c("accelerate");
var { velocity: Zs, vel: tr } = c("velocity", "vel");
var { gain: er } = c("gain");
var { postgain: nr } = c("postgain");
var { amp: sr } = c("amp");
var { attack: rr, att: or } = c("attack", "att");
var { fmh: cr, fmh1: ir, fmh2: ur, fmh3: ar, fmh4: lr, fmh5: pr, fmh6: fr, fmh7: hr, fmh8: dr } = V(["fmh", "fmi"], 8, "fmh");
var { fmi: mr, fmi1: yr, fmi2: wr, fmi3: gr, fmi4: br, fmi5: _r, fmi6: vr, fmi7: kr, fmi8: qr, fm: Sr, fm1: Ar, fm2: Tr, fm3: Cr, fm4: xr, fm5: Br, fm6: Or, fm7: zr, fm8: Mr } = V(["fmi", "fmh"], 8, "fm");
var { fmenv: Pr, fmenv1: Er, fmenv2: jr, fmenv3: Jr, fmenv4: $r, fmenv5: Nr, fmenv6: Lr, fmenv7: Rr, fmenv8: Wr } = V(
  "fmenv",
  8
);
var {
  fmattack: Fr,
  fmattack1: Ir,
  fmattack2: Vr,
  fmattack3: Hr,
  fmattack4: Dr,
  fmattack5: Gr,
  fmattack6: Qr,
  fmattack7: Ur,
  fmattack8: Xr,
  fmatt: Kr,
  fmatt1: Yr,
  fmatt2: Zr,
  fmatt3: to,
  fmatt4: eo,
  fmatt5: no,
  fmatt6: so,
  fmatt7: ro,
  fmatt8: oo
} = V("fmattack", 8, "fmatt");
var { fmwave: co, fmwave1: io, fmwave2: uo, fmwave3: ao, fmwave4: lo, fmwave5: po, fmwave6: fo, fmwave7: ho, fmwave8: mo } = V(
  "fmwave",
  8
);
var {
  fmdecay: yo,
  fmdecay1: wo,
  fmdecay2: go,
  fmdecay3: bo,
  fmdecay4: _o,
  fmdecay5: vo,
  fmdecay6: ko,
  fmdecay7: qo,
  fmdecay8: So,
  fmdec: Ao,
  fmdec1: To,
  fmdec2: Co,
  fmdec3: xo,
  fmdec4: Bo,
  fmdec5: Oo,
  fmdec6: zo,
  fmdec7: Mo,
  fmdec8: Po
} = V("fmdecay", 8, "fmdec");
var {
  fmsustain: Eo,
  fmsustain1: jo,
  fmsustain2: Jo,
  fmsustain3: $o,
  fmsustain4: No,
  fmsustain5: Lo,
  fmsustain6: Ro,
  fmsustain7: Wo,
  fmsustain8: Fo,
  fmsus: Io,
  fmsus1: Vo,
  fmsus2: Ho,
  fmsus3: Do,
  fmsus4: Go,
  fmsus5: Qo,
  fmsus6: Uo,
  fmsus7: Xo,
  fmsus8: Ko
} = V("fmsustain", 8, "fmsus");
var {
  fmrelease: Yo,
  fmrelease1: Zo,
  fmrelease2: tc,
  fmrelease3: ec,
  fmrelease4: nc,
  fmrelease5: sc,
  fmrelease6: rc,
  fmrelease7: oc,
  fmrelease8: cc,
  fmrel: ic,
  fmrel1: uc,
  fmrel2: ac,
  fmrel3: lc,
  fmrel4: pc,
  fmrel5: fc,
  fmrel6: hc,
  fmrel7: dc,
  fmrel8: mc
} = V("fmrelease", 8, "fmrel");
for (let t = 0; t <= 8; t++)
  for (let e = 0; e <= 8; e++)
    c(`fmi${t}${e}`, `fm${t}${e}`);
var { bank: yc } = c("bank");
var { chorus: wc } = c("chorus");
var { analyze: gc } = c("analyze");
var { fft: bc } = c("fft");
var { decay: _c, dec: vc } = c("decay", "dec");
var { sustain: kc, sus: qc } = c("sustain", "sus");
var { release: Sc, rel: Ac } = c("release", "rel");
var { hold: Tc } = c("hold");
var { bandf: Cc, bpf: xc, bp: Bc } = c(["bandf", "bandq", "bpenv"], "bpf", "bp");
var { bandq: Oc, bpq: zc } = c("bandq", "bpq");
var { begin: Mc } = c("begin");
var { end: Pc } = c("end");
var { loop: Ec } = c("loop");
var { loopBegin: jc, loopb: Jc } = c("loopBegin", "loopb");
var { loopEnd: $c, loope: Nc } = c("loopEnd", "loope");
var { crush: Lc } = c("crush");
var { coarse: Rc } = c("coarse");
var { tremolo: Wc, trem: Fc } = c(["tremolo", "tremolodepth", "tremoloskew", "tremolophase"], "trem");
var { tremolosync: Ic } = c(
  ["tremolosync", "tremolodepth", "tremoloskew", "tremolophase"],
  "tremsync"
);
var { tremolodepth: Vc } = c("tremolodepth", "tremdepth");
var { tremoloskew: Hc } = c("tremoloskew", "tremskew");
var { tremolophase: Dc } = c("tremolophase", "tremphase");
var { tremoloshape: Gc } = c("tremoloshape", "tremshape");
var { drive: Qc } = c("drive");
var { duck: Uc } = c("duckorbit", "duck");
var { duckdepth: Xc } = c("duckdepth");
var { duckonset: Kc } = c("duckonset", "duckons");
var { duckattack: Yc } = c("duckattack", "duckatt");
var { byteBeatExpression: Zc, bbexpr: ti } = c("byteBeatExpression", "bbexpr");
var { byteBeatStartTime: ei, bbst: ni } = c("byteBeatStartTime", "bbst");
var { channels: si, ch: ri } = c("channels", "ch");
var { pw: oi } = c(["pw", "pwrate", "pwsweep"]);
var { pwrate: ci } = c("pwrate");
var { pwsweep: ii } = c("pwsweep");
var { phaserrate: ui, ph: ai, phaser: li } = c(
  ["phaserrate", "phaserdepth", "phasercenter", "phasersweep"],
  "ph",
  "phaser"
);
var { phasersweep: pi, phs: fi } = c("phasersweep", "phs");
var { phasercenter: hi, phc: di } = c("phasercenter", "phc");
var { phaserdepth: mi, phd: yi, phasdp: wi } = c("phaserdepth", "phd", "phasdp");
var { channel: gi } = c("channel");
var { cut: bi } = c("cut");
var { cutoff: _i, ctf: vi, lpf: ki, lp: qi } = c(["cutoff", "resonance", "lpenv"], "ctf", "lpf", "lp");
var { lpenv: Si, lpe: Ai } = c("lpenv", "lpe");
var { hpenv: Ti, hpe: Ci } = c("hpenv", "hpe");
var { bpenv: xi, bpe: Bi } = c("bpenv", "bpe");
var { lpattack: Oi, lpa: zi } = c("lpattack", "lpa");
var { hpattack: Mi, hpa: Pi } = c("hpattack", "hpa");
var { bpattack: Ei, bpa: ji } = c("bpattack", "bpa");
var { lpdecay: Ji, lpd: $i } = c("lpdecay", "lpd");
var { hpdecay: Ni, hpd: Li } = c("hpdecay", "hpd");
var { bpdecay: Ri, bpd: Wi } = c("bpdecay", "bpd");
var { lpsustain: Fi, lps: Ii } = c("lpsustain", "lps");
var { hpsustain: Vi, hps: Hi } = c("hpsustain", "hps");
var { bpsustain: Di, bps: Gi } = c("bpsustain", "bps");
var { lprelease: Qi, lpr: Ui } = c("lprelease", "lpr");
var { hprelease: Xi, hpr: Ki } = c("hprelease", "hpr");
var { bprelease: Yi, bpr: Zi } = c("bprelease", "bpr");
var { ftype: tu } = c("ftype");
var { fanchor: eu } = c("fanchor");
var { lprate: nu } = c("lprate");
var { lpsync: su } = c("lpsync");
var { lpdepth: ru } = c("lpdepth");
var { lpdepthfrequency: ou, lpdepthfreq: cu } = c("lpdepthfrequency", "lpdepthfreq");
var { lpshape: iu } = c("lpshape");
var { lpdc: uu } = c("lpdc");
var { lpskew: au } = c("lpskew");
var { bprate: lu } = c("bprate");
var { bpsync: pu } = c("bpsync");
var { bpdepth: fu } = c("bpdepth");
var { bpdepthfrequency: hu, bpdepthfreq: du } = c("bpdepthfrequency", "bpdepthfreq");
var { bpshape: mu } = c("bpshape");
var { bpdc: yu } = c("bpdc");
var { bpskew: wu } = c("bpskew");
var { hprate: gu } = c("hprate");
var { hpsync: bu } = c("hpsync");
var { hpdepth: _u } = c("hpdepth");
var { hpdepthfrequency: vu, hpdepthfreq: ku } = c("hpdepthfrequency", "hpdepthfreq");
var { hpshape: qu } = c("hpshape");
var { hpdc: Su } = c("hpdc");
var { hpskew: Au } = c("hpskew");
var { vib: Tu, vibrato: Cu, v: xu } = c(["vib", "vibmod"], "vibrato", "v");
var { noise: Bu } = c("noise");
var { vibmod: Ou, vmod: zu } = c(["vibmod", "vib"], "vmod");
var { hcutoff: Mu, hpf: Pu, hp: Eu } = c(["hcutoff", "hresonance", "hpenv"], "hpf", "hp");
var { hresonance: ju, hpq: Ju } = c("hresonance", "hpq");
var { resonance: $u, lpq: Nu } = c("resonance", "lpq");
var { djf: Lu } = c("djf");
var { delay: Ru } = c(["delay", "delaytime", "delayfeedback"]);
var { delayfeedback: Wu, delayfb: Fu, dfb: Iu } = c("delayfeedback", "delayfb", "dfb");
var { delayspeed: Vu } = c("delayspeed");
var { delaytime: Hu, delayt: Du, dt: Gu } = c("delaytime", "delayt", "dt");
var { delaysync: Qu } = c("delaysync");
var { lock: Uu } = c("lock");
var { detune: Xu, det: Ku } = c("detune", "det");
var { unison: Yu } = c("unison");
var { spread: Zu } = c("spread");
var { dry: ta } = c("dry");
var { fadeTime: ea, fadeOutTime: na } = c("fadeTime", "fadeOutTime");
var { fadeInTime: sa } = c("fadeInTime");
var { freq: ra } = c("freq");
var { pattack: oa, patt: ca } = c("pattack", "patt");
var { pdecay: ia, pdec: ua } = c("pdecay", "pdec");
var { psustain: aa, psus: la } = c("psustain", "psus");
var { prelease: pa, prel: fa } = c("prelease", "prel");
var { penv: ha } = c("penv");
var { pcurve: da } = c("pcurve");
var { panchor: ma } = c("panchor");
var { gate: ya, gat: wa } = c("gate", "gat");
var { leslie: ga } = c("leslie");
var { lrate: ba } = c("lrate");
var { lsize: _a } = c("lsize");
var { activeLabel: va } = c("activeLabel");
var { label: ka } = c(["label", "activeLabel"]);
var { degree: qa } = c("degree");
var { mtranspose: Sa } = c("mtranspose");
var { ctranspose: Aa } = c("ctranspose");
var { harmonic: Ta } = c("harmonic");
var { stepsPerOctave: Ca } = c("stepsPerOctave");
var { octaveR: xa } = c("octaveR");
var { nudge: Ba } = c("nudge");
var { octave: Oa, oct: za } = c("octave", "oct");
var { orbit: Ma } = c("orbit", "o");
var { bus: Pa } = c("bus");
var { busgain: Ea, bgain: ja } = c("busgain", "bgain");
var { overgain: Ja } = c("overgain");
var { overshape: $a } = c("overshape");
var { pan: Na } = c("pan");
var { panspan: La } = c("panspan");
var { pansplay: Ra } = c("pansplay");
var { panwidth: Wa } = c("panwidth");
var { panorient: Fa } = c("panorient");
var { slide: Ia } = c("slide");
var { semitone: Va } = c("semitone");
var { voice: Ha } = c("voice");
var { chord: Da } = c("chord");
var { dictionary: Ga, dict: Qa } = c("dictionary", "dict");
var { anchor: Ua } = c("anchor");
var { offset: Xa } = c("offset");
var { octaves: Ka } = c("octaves");
var { mode: Ya } = c(["mode", "anchor"]);
var { room: Za } = c(["room", "size"]);
var { roomlp: tl, rlp: el } = c("roomlp", "rlp");
var { roomdim: nl, rdim: sl } = c("roomdim", "rdim");
var { roomfade: rl, rfade: ol } = c("roomfade", "rfade");
var { ir: cl, iresponse: il } = c(["ir", "i"], "iresponse");
var { irspeed: ul } = c("irspeed");
var { irbegin: al } = c("irbegin");
var { roomsize: ll, size: pl, sz: fl, rsize: hl } = c("roomsize", "size", "sz", "rsize");
var { shape: dl } = c(["shape", "shapevol"]);
var { distort: ml, dist: yl } = c(["distort", "distortvol", "distorttype"], "dist");
var { distortvol: wl } = c("distortvol", "distvol");
var { distorttype: gl } = c("distorttype", "disttype");
var { compressor: bl } = c([
  "compressor",
  "compressorRatio",
  "compressorKnee",
  "compressorAttack",
  "compressorRelease"
]);
var { compressorKnee: _l } = c("compressorKnee");
var { compressorRatio: vl } = c("compressorRatio");
var { compressorAttack: kl } = c("compressorAttack");
var { compressorRelease: ql } = c("compressorRelease");
var { speed: ye } = c("speed");
var { stretch: Sl } = c("stretch");
var { unit: Al } = c("unit");
var { squiz: Tl } = c("squiz");
var { vowel: Cl } = c("vowel");
var { waveloss: xl } = c("waveloss");
var { density: Bl } = c("density");
var { expression: Ol } = c("expression");
var { sustainpedal: zl } = c("sustainpedal");
var { fshift: Ml } = c("fshift");
var { fshiftnote: Pl } = c("fshiftnote");
var { fshiftphase: El } = c("fshiftphase");
var { triode: jl } = c("triode");
var { krush: Jl } = c("krush");
var { kcutoff: $l } = c("kcutoff");
var { octer: Nl } = c("octer");
var { octersub: Ll } = c("octersub");
var { octersubsub: Rl } = c("octersubsub");
var { ring: Wl } = c("ring");
var { ringf: Fl } = c("ringf");
var { ringdf: Il } = c("ringdf");
var { freeze: Vl } = c("freeze");
var { xsdelay: Hl } = c("xsdelay");
var { tsdelay: Dl } = c("tsdelay");
var { real: Gl } = c("real");
var { imag: Ql } = c("imag");
var { enhance: Ul } = c("enhance");
var { comb: Xl } = c("comb");
var { smear: Kl } = c("smear");
var { scram: Yl } = c("scram");
var { binshift: Zl } = c("binshift");
var { hbrick: tp } = c("hbrick");
var { lbrick: ep } = c("lbrick");
var { frameRate: np } = c("frameRate");
var { frames: sp } = c("frames");
var { hours: rp } = c("hours");
var { minutes: op } = c("minutes");
var { seconds: cp } = c("seconds");
var { songPtr: ip } = c("songPtr");
var { uid: up } = c("uid");
var { val: ap } = c("val");
var { cps: lp } = c("cps");
var { clip: pp, legato: fp } = c("clip", "legato");
var { duration: hp, dur: dp } = c("duration", "dur");
var { zrand: mp } = c("zrand");
var { curve: yp } = c("curve");
var { deltaSlide: wp } = c("deltaSlide");
var { pitchJump: gp } = c("pitchJump");
var { pitchJumpTime: bp } = c("pitchJumpTime");
var { znoise: _p } = c("znoise");
var { zmod: vp } = c("zmod");
var { zcrush: kp } = c("zcrush");
var { zdelay: qp } = c("zdelay");
var { zzfx: Sp } = c("zzfx");
var { color: Ap, colour: Tp } = c(["color", "colour"]);
var Cp = (...t) => t.reduce((e, n) => Object.assign(e, { [n]: Nt(n) }), {});
var xp = l("adsr", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n, s, r, o] = t;
  return e.set({ attack: n, decay: s, sustain: r, release: o });
});
var Bp = l("ad", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n, s = n] = t;
  return e.attack(n).decay(s);
});
var Op = l("ds", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n, s = 0] = t;
  return e.set({ decay: n, sustain: s });
});
var zp = l("ar", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n, s = n] = t;
  return e.set({ attack: n, release: s });
});
var { midichan: Mp } = c("midichan");
var { midimap: Pp } = c("midimap");
var { midiport: Ep } = c("midiport");
var { midicmd: jp } = c("midicmd");
var Jp = l("control", (t, e) => {
  if (!Array.isArray(t))
    throw new Error("control expects an array of [ccn, ccv]");
  const [n, s] = t;
  return e.ccn(n).ccv(s);
});
var { ccn: $p } = c("ccn");
var { ccv: Np } = c("ccv");
var { ctlNum: Lp } = c("ctlNum");
var { nrpnn: Rp } = c("nrpnn");
var { nrpv: Wp } = c("nrpv");
var { progNum: Fp } = c("progNum");
var Ip = l("sysex", (t, e) => {
  if (!Array.isArray(t))
    throw new Error("sysex expects an array of [id, data]");
  const [n, s] = t;
  return e.sysexid(n).sysexdata(s);
});
var { sysexid: Vp } = c("sysexid");
var { sysexdata: Hp } = c("sysexdata");
var { midibend: Dp } = c("midibend");
var { miditouch: Gp } = c("miditouch");
var { polyTouch: Qp } = c("polyTouch");
var { oschost: Up } = c("oschost");
var { oscport: Xp } = c("oscport");
var yt = (t) => at.has(t) ? at.get(t) : t;
var Kp = l("as", (t, e) => (t = Array.isArray(t) ? t : [t], e.fmap((n) => {
  n = Array.isArray(n) ? n : [n];
  const s = [];
  for (let r = 0; r < t.length; ++r)
    n[r] !== void 0 && s.push([yt(t[r]), n[r]]);
  return Object.fromEntries(s);
})));
var Yp = l(
  "scrub",
  (t, e) => t.outerBind((n) => {
    Array.isArray(n) || (n = [n]);
    const [s, r = 1] = n;
    return e.begin(s).mul(ye(r)).clip(1);
  }),
  false
);
var Bt = /* @__PURE__ */ new Map();
var Zp = (t, e, ...n) => {
  const s = Bt.get(t) ?? /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set([e, ...n]);
  for (const o of r)
    s.set(String(o).toLowerCase(), e);
  Bt.set(t, s);
};
var Lt = (t, e = []) => {
  for (const [n, ...s] of e)
    Zp(t, n, ...s);
};
var tf = (t, e) => {
  const n = Bt.get(t);
  return n ? n.get(String(e).toLowerCase()) ?? e : e;
};
Lt("lfo", [
  ["control", "c"],
  ["subControl", "sc"],
  ["rate", "r"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["dcoffset", "dc"],
  ["shape", "sh"],
  ["skew", "sk"],
  ["curve", "cu"],
  ["sync", "s"],
  ["fxi"]
]);
Lt("env", [
  ["control", "c"],
  ["subControl", "sc"],
  ["attack", "att", "a"],
  ["decay", "dec", "d"],
  ["sustain", "sus", "s"],
  ["release", "rel", "r"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["acurve", "ac"],
  ["dcurve", "dc"],
  ["rcurve", "rc"],
  ["fxi"]
]);
Lt("bmod", [
  ["bus", "b"],
  ["control", "c"],
  ["subControl", "sc"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["dc"],
  ["fxi"]
]);
f.prototype.modulate = function(t, e, n) {
  e = { control: void 0, ...e };
  const s = ["lfo", "env", "bmod"];
  if (!s.includes(t))
    return E(`[core] Modulation type ${t} not found. Please use one of 'lfo', 'env', 'bmod'`), this;
  let r = this, o;
  r = r.fmap((i2) => (a) => ({ v: i2, id: a })).appLeft(d(n));
  for (const [i2, a] of Object.entries(e)) {
    const u = tf(t, i2), p = d(a);
    r = r.fmap(({ v: h, id: y }) => (g) => {
      if (o === void 0) {
        let _2 = yt(Object.keys(h).at(-1));
        s.includes(_2) && (_2 = `${_2}_${[...h[_2].__ids].at(-1)}`), o = _2;
      }
      h[t] ??= { __ids: /* @__PURE__ */ new Set() };
      const v = h[t];
      return y ??= v.__ids.size, v[y] ??= { control: o }, v.__ids.add(y), g === void 0 ? { v: h, id: y } : (u === "control" || u === "subControl" ? v[y][u] = yt(g) : v[y][u] = g, { v: h, id: y });
    }).appLeft(p);
  }
  return r.fmap(({ v: i2 }) => i2);
};
f.prototype.lfo = function(t, e) {
  return this.modulate("lfo", t, e);
};
var ef = (t) => C({}).lfo(t);
f.prototype.env = function(t, e) {
  return this.modulate("env", t, e);
};
var nf = (t) => C({}).env(t);
f.prototype.bmod = function(t, e) {
  return this.modulate("bmod", t, e);
};
var sf = (t) => C({}).bmod(t);
var { transient: rf } = c(["transient", "transsustain"]);
var { FXrelease: of, FXrel: cf, FXr: uf, fxr: af } = c("FXrelease", "FXrel", "FXr", "fxr");
var gy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FXr: uf,
  FXrel: cf,
  FXrelease: of,
  accelerate: Ys,
  activeLabel: va,
  ad: Bp,
  adsr: xp,
  amp: sr,
  analyze: gc,
  anchor: Ua,
  ar: zp,
  as: Kp,
  att: or,
  attack: rr,
  bandf: Cc,
  bandq: Oc,
  bank: yc,
  bbexpr: ti,
  bbst: ni,
  begin: Mc,
  bgain: ja,
  binshift: Zl,
  bmod: sf,
  bp: Bc,
  bpa: ji,
  bpattack: Ei,
  bpd: Wi,
  bpdc: yu,
  bpdecay: Ri,
  bpdepth: fu,
  bpdepthfreq: du,
  bpdepthfrequency: hu,
  bpe: Bi,
  bpenv: xi,
  bpf: xc,
  bpq: zc,
  bpr: Zi,
  bprate: lu,
  bprelease: Yi,
  bps: Gi,
  bpshape: mu,
  bpskew: wu,
  bpsustain: Di,
  bpsync: pu,
  bus: Pa,
  busgain: Ea,
  byteBeatExpression: Zc,
  byteBeatStartTime: ei,
  ccn: $p,
  ccv: Np,
  ch: ri,
  channel: gi,
  channels: si,
  chord: Da,
  chorus: wc,
  clip: pp,
  coarse: Rc,
  color: Ap,
  colour: Tp,
  comb: Xl,
  compressor: bl,
  compressorAttack: kl,
  compressorKnee: _l,
  compressorRatio: vl,
  compressorRelease: ql,
  control: Jp,
  cps: lp,
  createParam: Nt,
  createParams: Cp,
  crush: Lc,
  ctf: vi,
  ctlNum: Lp,
  ctranspose: Aa,
  curve: yp,
  cut: bi,
  cutoff: _i,
  dec: vc,
  decay: _c,
  degree: qa,
  delay: Ru,
  delayfb: Fu,
  delayfeedback: Wu,
  delayspeed: Vu,
  delaysync: Qu,
  delayt: Du,
  delaytime: Hu,
  deltaSlide: wp,
  density: Bl,
  det: Ku,
  detune: Xu,
  dfb: Iu,
  dict: Qa,
  dictionary: Ga,
  dist: yl,
  distort: ml,
  distorttype: gl,
  distortvol: wl,
  djf: Lu,
  drive: Qc,
  dry: ta,
  ds: Op,
  dt: Gu,
  duck: Uc,
  duckattack: Yc,
  duckdepth: Xc,
  duckonset: Kc,
  dur: dp,
  duration: hp,
  end: Pc,
  enhance: Ul,
  env: nf,
  expression: Ol,
  fadeInTime: sa,
  fadeOutTime: na,
  fadeTime: ea,
  fanchor: eu,
  fft: bc,
  fm: Sr,
  fm1: Ar,
  fm2: Tr,
  fm3: Cr,
  fm4: xr,
  fm5: Br,
  fm6: Or,
  fm7: zr,
  fm8: Mr,
  fmatt: Kr,
  fmatt1: Yr,
  fmatt2: Zr,
  fmatt3: to,
  fmatt4: eo,
  fmatt5: no,
  fmatt6: so,
  fmatt7: ro,
  fmatt8: oo,
  fmattack: Fr,
  fmattack1: Ir,
  fmattack2: Vr,
  fmattack3: Hr,
  fmattack4: Dr,
  fmattack5: Gr,
  fmattack6: Qr,
  fmattack7: Ur,
  fmattack8: Xr,
  fmdec: Ao,
  fmdec1: To,
  fmdec2: Co,
  fmdec3: xo,
  fmdec4: Bo,
  fmdec5: Oo,
  fmdec6: zo,
  fmdec7: Mo,
  fmdec8: Po,
  fmdecay: yo,
  fmdecay1: wo,
  fmdecay2: go,
  fmdecay3: bo,
  fmdecay4: _o,
  fmdecay5: vo,
  fmdecay6: ko,
  fmdecay7: qo,
  fmdecay8: So,
  fmenv: Pr,
  fmenv1: Er,
  fmenv2: jr,
  fmenv3: Jr,
  fmenv4: $r,
  fmenv5: Nr,
  fmenv6: Lr,
  fmenv7: Rr,
  fmenv8: Wr,
  fmh: cr,
  fmh1: ir,
  fmh2: ur,
  fmh3: ar,
  fmh4: lr,
  fmh5: pr,
  fmh6: fr,
  fmh7: hr,
  fmh8: dr,
  fmi: mr,
  fmi1: yr,
  fmi2: wr,
  fmi3: gr,
  fmi4: br,
  fmi5: _r,
  fmi6: vr,
  fmi7: kr,
  fmi8: qr,
  fmrel: ic,
  fmrel1: uc,
  fmrel2: ac,
  fmrel3: lc,
  fmrel4: pc,
  fmrel5: fc,
  fmrel6: hc,
  fmrel7: dc,
  fmrel8: mc,
  fmrelease: Yo,
  fmrelease1: Zo,
  fmrelease2: tc,
  fmrelease3: ec,
  fmrelease4: nc,
  fmrelease5: sc,
  fmrelease6: rc,
  fmrelease7: oc,
  fmrelease8: cc,
  fmsus: Io,
  fmsus1: Vo,
  fmsus2: Ho,
  fmsus3: Do,
  fmsus4: Go,
  fmsus5: Qo,
  fmsus6: Uo,
  fmsus7: Xo,
  fmsus8: Ko,
  fmsustain: Eo,
  fmsustain1: jo,
  fmsustain2: Jo,
  fmsustain3: $o,
  fmsustain4: No,
  fmsustain5: Lo,
  fmsustain6: Ro,
  fmsustain7: Wo,
  fmsustain8: Fo,
  fmwave: co,
  fmwave1: io,
  fmwave2: uo,
  fmwave3: ao,
  fmwave4: lo,
  fmwave5: po,
  fmwave6: fo,
  fmwave7: ho,
  fmwave8: mo,
  frameRate: np,
  frames: sp,
  freeze: Vl,
  freq: ra,
  fshift: Ml,
  fshiftnote: Pl,
  fshiftphase: El,
  ftype: tu,
  fxr: af,
  gain: er,
  gat: wa,
  gate: ya,
  getControlName: yt,
  harmonic: Ta,
  hbrick: tp,
  hcutoff: Mu,
  hold: Tc,
  hours: rp,
  hp: Eu,
  hpa: Pi,
  hpattack: Mi,
  hpd: Li,
  hpdc: Su,
  hpdecay: Ni,
  hpdepth: _u,
  hpdepthfreq: ku,
  hpdepthfrequency: vu,
  hpe: Ci,
  hpenv: Ti,
  hpf: Pu,
  hpq: Ju,
  hpr: Ki,
  hprate: gu,
  hprelease: Xi,
  hps: Hi,
  hpshape: qu,
  hpskew: Au,
  hpsustain: Vi,
  hpsync: bu,
  hresonance: ju,
  imag: Ql,
  ir: cl,
  irbegin: al,
  iresponse: il,
  irspeed: ul,
  isControlName: is,
  kcutoff: $l,
  krush: Jl,
  label: ka,
  lbrick: ep,
  legato: fp,
  leslie: ga,
  lfo: ef,
  lock: Uu,
  loop: Ec,
  loopBegin: jc,
  loopEnd: $c,
  loopb: Jc,
  loope: Nc,
  lp: qi,
  lpa: zi,
  lpattack: Oi,
  lpd: $i,
  lpdc: uu,
  lpdecay: Ji,
  lpdepth: ru,
  lpdepthfreq: cu,
  lpdepthfrequency: ou,
  lpe: Ai,
  lpenv: Si,
  lpf: ki,
  lpq: Nu,
  lpr: Ui,
  lprate: nu,
  lprelease: Qi,
  lps: Ii,
  lpshape: iu,
  lpskew: au,
  lpsustain: Fi,
  lpsync: su,
  lrate: ba,
  lsize: _a,
  midibend: Dp,
  midichan: Mp,
  midicmd: jp,
  midimap: Pp,
  midiport: Ep,
  miditouch: Gp,
  minutes: op,
  mode: Ya,
  mtranspose: Sa,
  n: Xs,
  noise: Bu,
  note: Ks,
  nrpnn: Rp,
  nrpv: Wp,
  nudge: Ba,
  oct: za,
  octave: Oa,
  octaveR: xa,
  octaves: Ka,
  octer: Nl,
  octersub: Ll,
  octersubsub: Rl,
  offset: Xa,
  orbit: Ma,
  oschost: Up,
  oscport: Xp,
  overgain: Ja,
  overshape: $a,
  pan: Na,
  panchor: ma,
  panorient: Fa,
  panspan: La,
  pansplay: Ra,
  panwidth: Wa,
  patt: ca,
  pattack: oa,
  pcurve: da,
  pdec: ua,
  pdecay: ia,
  penv: ha,
  ph: ai,
  phasdp: wi,
  phaser: li,
  phasercenter: hi,
  phaserdepth: mi,
  phaserrate: ui,
  phasersweep: pi,
  phc: di,
  phd: yi,
  phs: fi,
  pitchJump: gp,
  pitchJumpTime: bp,
  polyTouch: Qp,
  postgain: nr,
  prel: fa,
  prelease: pa,
  progNum: Fp,
  psus: la,
  psustain: aa,
  pw: oi,
  pwrate: ci,
  pwsweep: ii,
  rdim: sl,
  real: Gl,
  registerControl: c,
  registerMultiControl: V,
  rel: Ac,
  release: Sc,
  resonance: $u,
  rfade: ol,
  ring: Wl,
  ringdf: Il,
  ringf: Fl,
  rlp: el,
  room: Za,
  roomdim: nl,
  roomfade: rl,
  roomlp: tl,
  roomsize: ll,
  rsize: hl,
  s: us,
  scram: Yl,
  scrub: Yp,
  seconds: cp,
  semitone: Va,
  shape: dl,
  size: pl,
  slide: Ia,
  smear: Kl,
  songPtr: ip,
  sound: as,
  source: Qs,
  speed: ye,
  spread: Zu,
  squiz: Tl,
  src: Us,
  stepsPerOctave: Ca,
  stretch: Sl,
  sus: qc,
  sustain: kc,
  sustainpedal: zl,
  sysex: Ip,
  sysexdata: Hp,
  sysexid: Vp,
  sz: fl,
  transient: rf,
  trem: Fc,
  tremolo: Wc,
  tremolodepth: Vc,
  tremolophase: Dc,
  tremoloshape: Gc,
  tremoloskew: Hc,
  tremolosync: Ic,
  triode: jl,
  tsdelay: Dl,
  uid: up,
  unison: Yu,
  unit: Al,
  v: xu,
  val: ap,
  vel: tr,
  velocity: Zs,
  vib: Tu,
  vibmod: Ou,
  vibrato: Cu,
  vmod: zu,
  voice: Ha,
  vowel: Cl,
  warp: Cs,
  warpatt: Os,
  warpattack: Bs,
  warpdc: Rs,
  warpdec: Ms,
  warpdecay: zs,
  warpdepth: Ns,
  warpenv: Ds,
  warpmode: Fs,
  warprate: $s,
  warprel: Js,
  warprelease: js,
  warpshape: Ls,
  warpskew: Ws,
  warpsus: Es,
  warpsustain: Ps,
  warpsync: Gs,
  waveloss: xl,
  wavetablePhaseRand: Hs,
  wavetablePosition: ps,
  wavetableWarp: xs,
  wavetableWarpMode: Is,
  wt: ls,
  wtatt: ds,
  wtattack: hs,
  wtdc: As,
  wtdec: ys,
  wtdecay: ms,
  wtdepth: qs,
  wtenv: fs,
  wtphaserand: Vs,
  wtrate: vs,
  wtrel: _s,
  wtrelease: bs,
  wtshape: Ss,
  wtskew: Ts,
  wtsus: gs,
  wtsustain: ws,
  wtsync: ks,
  xsdelay: Hl,
  zcrush: kp,
  zdelay: qp,
  zmod: vp,
  znoise: _p,
  zrand: mp,
  zzfx: Sp
}, Symbol.toStringTag, { value: "Module" }));
var lf = function(t, e) {
  const [n, s] = t, [r, o] = e, [i2, a] = ue(s, r);
  return [
    [s, n - s],
    [Pt((u, p) => u.concat(p), i2, o), a]
  ];
};
var pf = function(t, e) {
  const [n, s] = t, [r, o] = e, [i2, a] = ue(n, o);
  return [
    [n, s - n],
    [Pt((p, h) => p.concat(h), r, i2), a]
  ];
};
var we = function(t, e) {
  const [n, s] = t;
  return Math.min(n, s) <= 1 ? [t, e] : we(...n > s ? lf(t, e) : pf(t, e));
};
var ge = function(t, e) {
  const n = t < 0, s = Math.abs(t), r = e - s, o = Array(s).fill([1]), i2 = Array(r).fill([0]), a = we([s, r], [o, i2]), u = G(a[1][0]).concat(G(a[1][1]));
  return n ? u.map((p) => 1 - p) : u;
};
var kt = function(t, e, n) {
  const s = ge(t, e);
  return n ? rn(s, -n) : s;
};
var by = l("euclid", function(t, e, n) {
  return n.struct(kt(t, e, 0));
});
var _y = l("bjork", function(t, e) {
  Array.isArray(t) || (t = [t]);
  const [n, s = n, r = 0] = t;
  return e.struct(kt(n, s, r));
});
var { euclidrot: vy, euclidRot: ky } = l(["euclidrot", "euclidRot"], function(t, e, n, s) {
  return s.struct(kt(t, e, n));
});
var be = function(t, e, n, s) {
  if (t < 1)
    return q;
  const o = kt(t, e, 0).join("").split("1").slice(1).map((i2) => [i2.length + 1, true]);
  return s.struct(ns(...o)).late(m(n).div(e));
};
var qy = l(["euclidLegato"], function(t, e, n) {
  return be(t, e, 0, n);
});
var Sy = l(["euclidLegatoRot"], function(t, e, n, s) {
  return be(t, e, n, s);
});
var { euclidish: Ay, eish: Ty } = l(["euclidish", "eish"], function(t, e, n, s) {
  const r = de(ge(t, e), new Array(t).fill(1), n);
  return s.struct(r).setSteps(e);
});
function ff(t, e, n = 0.05, s = 0.1, r = 0.1, o = globalThis.setInterval, i2 = globalThis.clearInterval, a = true) {
  let u = 0, p = 0, h = 10 ** 4, y = 0.01;
  const g = (x) => n = x(n);
  r = r || s / 2;
  const v = () => {
    const x = t(), D2 = x + s + r;
    for (p === 0 && (p = x + y); p < D2; )
      p = a ? Math.round(p * h) / h : p, e(p, n, u, x), p += n, u++;
  };
  let _2;
  const O = () => {
    A3(), v(), _2 = o(v, s * 1e3);
  }, A3 = () => {
    _2 !== void 0 && i2(_2), _2 = void 0;
  };
  return { setDuration: g, start: O, stop: () => {
    u = 0, p = 0, A3();
  }, pause: () => A3(), duration: n, interval: s, getPhase: () => p, minLatency: y };
}
var hf = class {
  constructor({
    interval: e,
    onTrigger: n,
    onToggle: s,
    onError: r,
    getTime: o,
    latency: i2 = 0.1,
    setInterval: a,
    clearInterval: u,
    beforeStart: p
  }) {
    this.started = false, this.beforeStart = p, this.cps = 0.5, this.num_ticks_since_cps_change = 0, this.lastTick = 0, this.lastBegin = 0, this.lastEnd = 0, this.getTime = o, this.num_cycles_at_cps_change = 0, this.seconds_at_cps_change, this.onToggle = s, this.latency = i2, this.clock = ff(
      o,
      // called slightly before each cycle
      (h, y, g, v) => {
        this.num_ticks_since_cps_change === 0 && (this.num_cycles_at_cps_change = this.lastEnd, this.seconds_at_cps_change = h), this.num_ticks_since_cps_change++;
        const O = this.num_ticks_since_cps_change * y * this.cps;
        try {
          const A3 = this.lastEnd;
          this.lastBegin = A3;
          const I3 = this.num_cycles_at_cps_change + O;
          if (this.lastEnd = I3, this.lastTick = h, h < v) {
            console.log("skip query: too late");
            return;
          }
          this.pattern.queryArc(A3, I3, { _cps: this.cps, cyclist: "cyclist" }).forEach((P3) => {
            if (P3.hasOnset()) {
              const x = (P3.whole.begin - this.num_cycles_at_cps_change) / this.cps + this.seconds_at_cps_change + i2, D2 = P3.duration / this.cps, nt = x - h;
              n?.(P3, nt, D2, this.cps, x), P3.value.cps !== void 0 && this.cps != P3.value.cps && (this.cps = P3.value.cps, this.num_ticks_since_cps_change = 0);
            }
          });
        } catch (A3) {
          zt(A3), r?.(A3);
        }
      },
      e,
      // duration of each cycle
      0.1,
      0.1,
      a,
      u
    );
  }
  now() {
    if (!this.started)
      return 0;
    const e = this.getTime() - this.lastTick - this.clock.duration;
    return this.lastBegin + e * this.cps;
  }
  setStarted(e) {
    this.started = e, this.onToggle?.(e);
  }
  async start() {
    if (await this.beforeStart?.(), this.num_ticks_since_cps_change = 0, this.num_cycles_at_cps_change = 0, !this.pattern)
      throw new Error("Scheduler: no pattern set! call .setPattern first.");
    E("[cyclist] start"), this.clock.start(), this.setStarted(true);
  }
  pause() {
    E("[cyclist] pause"), this.clock.pause(), this.setStarted(false);
  }
  stop() {
    E("[cyclist] stop"), this.clock.stop(), this.lastEnd = 0, this.setStarted(false);
  }
  async setPattern(e, n = false) {
    this.pattern = e, n && !this.started && await this.start();
  }
  setCps(e = 0.5) {
    this.cps !== e && (this.cps = e, this.num_ticks_since_cps_change = 0);
  }
  log(e, n, s) {
    const r = s.filter((o) => o.hasOnset());
    console.log(`${e.toFixed(4)} - ${n.toFixed(4)} ${Array(r.length).fill("I").join("")}`);
  }
};
var ct = {};
var df = function() {
  mf();
};
var mf = function() {
  ct = {};
};
var Cy = l(
  "timeline",
  function(t, e) {
    t = d(t);
    const n = function(s) {
      const r = !!s.controls.cyclist, o = t.query(s), i2 = [];
      for (const a of o) {
        const u = a.value;
        let p;
        if (u === 0)
          p = 0;
        else if (u in ct)
          p = ct[u];
        else {
          const y = a.wholeOrPart();
          !r || s.span.begin.lt(y.midpoint()) ? p = y.begin : p = y.end;
        }
        r && (ct[u] = p, u !== 0 && delete ct[-u]);
        const h = e.late(p).query(s.setSpan(a.part)).map((y) => y.setContext(y.combineContext(a)));
        i2.push(...h);
      }
      return i2;
    };
    return new f(n, e._steps);
  },
  false
);
var F = function(t, e, n = true) {
  const s = Array.isArray(t), r = Object.keys(t).length;
  return t = bn(t, d), r === 0 ? q : e.fmap((o) => {
    let i2 = o;
    return s && (i2 = n ? Math.round(i2) % r : an(Math.round(i2), 0, t.length - 1)), t[i2];
  });
};
var yf = function(t, e) {
  return Array.isArray(e) && ([e, t] = [t, e]), wf(t, e);
};
var wf = l("pick", function(t, e) {
  return F(t, e, false).innerJoin();
});
var gf = l("pickmod", function(t, e) {
  return F(t, e, true).innerJoin();
});
var xy = l("pickF", function(t, e, n) {
  return n.apply(yf(t, e));
});
var By = l("pickmodF", function(t, e, n) {
  return n.apply(gf(t, e));
});
var Oy = l("pickOut", function(t, e) {
  return F(t, e, false).outerJoin();
});
var zy = l("pickmodOut", function(t, e) {
  return F(t, e, true).outerJoin();
});
var My = l("pickRestart", function(t, e) {
  return F(t, e, false).restartJoin();
});
var Py = l("pickmodRestart", function(t, e) {
  return F(t, e, true).restartJoin();
});
var Ey = l("pickReset", function(t, e) {
  return F(t, e, false).resetJoin();
});
var jy = l("pickmodReset", function(t, e) {
  return F(t, e, true).resetJoin();
});
var { inhabit: Jy, pickSqueeze: $y } = l(["inhabit", "pickSqueeze"], function(t, e) {
  return F(t, e, false).squeezeJoin();
});
var { inhabitmod: Ny, pickmodSqueeze: Ly } = l(["inhabitmod", "pickmodSqueeze"], function(t, e) {
  return F(t, e, true).squeezeJoin();
});
var Ry = (t, e) => (e = e.map(d), e.length == 0 ? q : t.fmap((n) => {
  const s = bt(Math.round(n), e.length);
  return e[s];
}).squeezeJoin());
var bf = class {
  constructor({ onTrigger: e, onToggle: n, getTime: s }) {
    this.started = false, this.cps = 0.5, this.getTime = s, this.time_at_last_tick_message = 0, this.collator = new _n({ getTargetClockTime: s }), this.onToggle = n, this.latency = 0.1, this.cycle = 0, this.id = Math.round(Date.now() * Math.random()), this.worker = new SharedWorker(new URL(
      /* @vite-ignore */
      "" + new URL("assets/clockworker-ZDiUtESR.js", import.meta.url).href,
      import.meta.url
    )), this.worker.port.start(), this.channel = new BroadcastChannel("strudeltick");
    const r = (i2) => {
      const { cps: a, begin: u, end: p, cycle: h, time: y } = i2;
      this.cps = a, this.cycle = h;
      const g = this.collator.calculateOffset(y) + y;
      o(u, p, g), this.time_at_last_tick_message = g;
    }, o = (i2, a, u) => {
      if (this.started === false)
        return;
      this.pattern.queryArc(i2, a, { _cps: this.cps, cyclist: "neocyclist" }).forEach((h) => {
        if (h.hasOnset()) {
          const g = Kt(h.whole.begin - this.cycle, this.cps) + u + this.latency, v = Kt(h.duration, this.cps);
          e?.(h, 0, v, this.cps, g);
        }
      });
    };
    this.channel.onmessage = (i2) => {
      if (!this.started)
        return;
      const { payload: a, type: u } = i2.data;
      switch (u) {
        case "tick":
          r(a);
      }
    };
  }
  sendMessage(e, n) {
    this.worker.port.postMessage({ type: e, payload: n, id: this.id });
  }
  now() {
    const e = (this.getTime() - this.time_at_last_tick_message) * this.cps;
    return this.cycle + e;
  }
  setCps(e = 1) {
    this.sendMessage("cpschange", { cps: e });
  }
  setCycle(e) {
    this.sendMessage("setcycle", { cycle: e });
  }
  setStarted(e) {
    this.sendMessage("toggle", { started: e }), this.started = e, this.onToggle?.(e);
  }
  start() {
    E("[cyclist] start"), this.setStarted(true);
  }
  stop() {
    E("[cyclist] stop"), this.collator.reset(), this.setStarted(false);
  }
  setPattern(e, n = false) {
    this.pattern = e, n && !this.started && this.start();
  }
  log(e, n, s) {
    const r = s.filter((o) => o.hasOnset());
    console.log(`${e.toFixed(4)} - ${n.toFixed(4)} ${Array(r.length).fill("I").join("")}`);
  }
};
var Ot;
var _e;
var ve;
var ke;
var qe;
function Wy() {
  if (!Ot)
    throw new Error("no time set! use setTime to define a time source");
  return Ot();
}
function ee(t) {
  Ot = t;
}
function _f(t) {
  _e = t;
}
function Fy() {
  return _e?.();
}
function vf(t) {
  ve = t;
}
function Iy() {
  return ve;
}
function kf(t) {
  ke = t;
}
function Vy() {
  return ke;
}
function qf(t) {
  qe = !!t;
}
function Hy() {
  return qe;
}
function Dy({
  defaultOutput: t,
  onEvalError: e,
  beforeEval: n,
  beforeStart: s,
  afterEval: r,
  getTime: o,
  transpiler: i2,
  onToggle: a,
  editPattern: u,
  onUpdateState: p,
  sync: h = false,
  setInterval: y,
  clearInterval: g,
  id: v,
  mondo: _2 = false
}) {
  const O = new SalatRepl({ localScope: true }), A3 = {
    schedulerError: void 0,
    evalError: void 0,
    code: "// LOADING",
    activeCode: "// LOADING",
    pattern: void 0,
    miniLocations: [],
    widgets: [],
    pending: false,
    started: false
  }, I3 = {
    id: v
  }, H2 = (b2) => {
    Object.assign(A3, b2), A3.isDirty = A3.code !== A3.activeCode, A3.error = A3.evalError || A3.schedulerError, p?.(A3);
  }, P3 = {
    onTrigger: Sf({ defaultOutput: t, getTime: o }),
    getTime: o,
    onToggle: (b2) => {
      H2({ started: b2 }), qf(b2), a?.(b2), b2 || df();
    },
    setInterval: y,
    clearInterval: g,
    beforeStart: s
  }, x = h && typeof SharedWorker < "u" ? new bf(P3) : new hf(P3);
  kf(P3.onTrigger), _f(() => x.cps);
  let D2 = {}, nt = 0, tt;
  const Vt = function() {
    return D2 = {}, nt = 0, tt = void 0, q;
  }, Je = (b2) => O.evaluate(b2).compile({ log: false });
  function Ht(b2) {
    return b2._Pattern ? b2.__pure : b2;
  }
  const Dt = async (b2, k2 = true) => (b2 = u?.(b2) || b2, await x.setPattern(b2, k2), vf(b2), b2);
  ee(() => x.now());
  const $e = () => x.stop(), Ne = () => x.start(), Le = () => x.pause(), Re = () => x.toggle(), St = (b2) => (x.setCps(Ht(b2)), q), Gt = (b2) => (x.setCps(Ht(b2) / 60), q);
  let ft = [];
  const We = function(b2) {
    return ft.push(b2), q;
  }, Fe = function(b2) {
    return tt = b2, q;
  }, Ie = () => {
    f.prototype.p = function(k2) {
      return typeof k2 == "string" && (k2.startsWith("_") || k2.endsWith("_")) ? q : (k2.includes("$") && (k2 = `${k2}${nt}`, nt++), D2[k2] = this, this);
    }, f.prototype.q = function(k2) {
      return q;
    };
    try {
      for (let k2 = 1; k2 < 10; ++k2)
        Object.defineProperty(f.prototype, `d${k2}`, {
          get() {
            return this.p(k2);
          },
          configurable: true
        }), Object.defineProperty(f.prototype, `p${k2}`, {
          get() {
            return this.p(k2);
          },
          configurable: true
        }), f.prototype[`q${k2}`] = q;
    } catch (k2) {
      console.warn("injectPatternMethods: error:", k2);
    }
    const b2 = l("cpm", function(k2, At) {
      return At._fast(k2 / 60 / x.cps);
    });
    return xn({
      all: We,
      each: Fe,
      hush: Vt,
      cpm: b2,
      setCps: St,
      setcps: St,
      setCpm: Gt,
      setcpm: Gt,
      compileKabel: Je
    });
  };
  return { scheduler: x, evaluate: async (b2, k2 = true, At = true) => {
    if (!b2)
      throw new Error("no code to evaluate");
    try {
      H2({ code: b2, pending: true }), await Ie(), ee(() => x.now()), await n?.({ code: b2 }), ft = [], At && Vt(), _2 && (b2 = `mondolang\`${b2}\``);
      let { pattern: M, meta: Tt } = await On(b2, i2, I3);
      if (Object.keys(D2).length) {
        let X2 = [], ht = false;
        for (const [st, Ve] of Object.entries(D2)) {
          const Qt = st.length > 1 && st.startsWith("S");
          if (Qt && ht === false && (X2 = [], ht = true), !ht || ht && Qt) {
            const He = Ve.withState((De) => De.setControls({ id: st }));
            X2.push(He);
          }
        }
        tt && (X2 = X2.map((st) => tt(st))), M = z(...X2);
      } else tt && (M = tt(M));
      if (ft.length)
        for (const X2 of ft)
          M = X2(M);
      return pe(M) || (M = q), E("[eval] code updated"), M = await Dt(M, k2), H2({
        miniLocations: Tt?.miniLocations || [],
        widgets: Tt?.widgets || [],
        activeCode: b2,
        pattern: M,
        evalError: void 0,
        schedulerError: void 0,
        pending: false
      }), r?.({ code: b2, pattern: M, meta: Tt }), M;
    } catch (M) {
      E(`[eval] error: ${M.message}`, "error"), console.error(M), H2({ evalError: M, pending: false }), e?.(M);
    }
  }, start: Ne, stop: $e, pause: Le, setCps: St, setPattern: Dt, setCode: (b2) => H2({ code: b2 }), toggle: Re, state: A3 };
}
var Sf = ({ getTime: t, defaultOutput: e }) => async (n, s, r, o, i2) => {
  try {
    (!n.context.onTrigger || !n.context.dominantTrigger) && await e(n, s, r, o, i2), n.context.onTrigger && await n.context.onTrigger(n, t(), o, i2);
  } catch (a) {
    zt(a, "getTrigger");
  }
};
function Gy(t) {
  return new f((e) => [new S(void 0, e.span, t)]);
}
var j = (t) => {
  const e = (n) => [new S(void 0, n.span, t(n.span.begin, n.controls))];
  return new f(e);
};
var qt = j((t) => t % 1);
var Se = qt.toBipolar();
var Rt = j((t) => 1 - t % 1);
var Ae = Rt.toBipolar();
var Te = j((t) => Math.sin(Math.PI * 2 * t));
var Af = Te.fromBipolar();
var Qy = Af._early(m(1).div(4));
var Uy = Te._early(m(1).div(4));
var Tf = j((t) => Math.floor(t * 2 % 2));
var Xy = Tf.toBipolar();
var Ky = N(qt, Rt);
var Yy = N(Se, Ae);
var Zy = N(Rt, qt);
var tw = N(Ae, Se);
var ew = j(ot);
var Wt = 0;
var Ft = 0;
typeof window < "u" && document.addEventListener("mousemove", (t) => {
  Wt = t.clientY / document.body.clientHeight, Ft = t.clientX / document.body.clientWidth;
});
var nw = j(() => Wt);
var sw = j(() => Wt);
var rw = j(() => Ft);
var ow = j(() => Ft);
var Cf = (t) => (t |= 0, t ^= t >>> 16, t = Math.imul(t, 2246822507), t ^= t >>> 13, t = Math.imul(t, 3266489909), t ^= t >>> 16, t >>> 0);
var xf = (t) => Math.floor(t * 536870912);
var Bf = (t, e = 0, n = 0) => {
  const s = t >>> 0 >>> 0, r = Math.floor(t / 4294967296) >>> 0;
  let o = s ^ Math.imul(r ^ 2246822507, 3266489909);
  return o ^= Math.imul(e ^ 2135587861, 2654435769), o ^= Math.imul(n ^ 374761393, 668265261), o >>> 0;
};
var ne = (t, e = 0, n = 0) => Cf(Bf(t, e, n)) / 4294967296;
var Of = (t, e, n = 0) => {
  const s = xf(t);
  if (e === 1)
    return ne(s, 0, n);
  const r = new Array(e);
  for (let o = 0; o < e; o++) r[o] = ne(s, o, n);
  return r;
};
var Ce = (t) => {
  const e = t << 13 ^ t, n = e >> 17 ^ e;
  return n << 5 ^ n;
};
var zf = (t) => t - Math.trunc(t);
var Mf = (t) => Ce(Math.trunc(zf(t / 300) * 536870912));
var se = (t) => t % 536870912 / 536870912;
var Pf = (t, e) => {
  if (e === 1)
    return Math.abs(se(t));
  const n = [];
  for (let s = 0; s < e; s++)
    n.push(se(t)), t = Ce(t);
  return n;
};
var Ef = (t, e) => Pf(Mf(t), e);
var xe = "legacy";
var K = (t, e = 1, n = 0) => xe === "legacy" ? Ef(t + n, e) : Of(t, e, n);
var cw = (t = "legacy") => xe = t;
var jf = (t) => qt.range(0, t).round().segment(t);
var iw = (t) => {
  const e = d(t).log2(0).floor().add(1);
  return Jf(t, e);
};
var Jf = (t, e = 16) => {
  e = d(e);
  const n = jf(e).mul(-1).add(e.sub(1));
  return d(t).segment(e).brshift(n).band(C(1));
};
var uw = (t) => {
  const e = d(t).log2(0).floor().add(1);
  return $f(t, e);
};
var $f = (t, e = 16) => d(t).withValue((n) => (s) => {
  const r = [];
  for (let o = s - 1; o >= 0; o--)
    r.push(n >> o & 1);
  return r;
}).appLeft(d(e));
var aw = (t) => j((e) => (n) => K(e, n).map(Math.abs)).appLeft(d(t));
var Nf = (t) => j((e, n) => {
  const r = K(e.floor().add(0.5), t, n.randSeed).map((i2, a) => [i2, a]).sort((i2, a) => (i2[0] > a[0]) - (i2[0] < a[0])).map((i2) => i2[1]), o = e.cyclePos().mul(t).floor() % t;
  return r[o];
})._segment(t);
var Be = (t, e, n) => {
  const s = [...Array(e).keys()].map((r) => n.zoom(m(r).div(e), m(r + 1).div(e)));
  return t.fmap((r) => s[r].repeatCycles(e)._fast(e)).innerJoin();
};
var lw = l("shuffle", (t, e) => Be(Nf(t), t, e));
var pw = l("scramble", (t, e) => Be(ze(t)._segment(t), t, e));
var Lf = (t, e) => new f((n) => {
  let { randSeed: s, ...r } = n.controls;
  return s = t(s), e.query(n.setControls({ ...r, randSeed: s }));
}, e._steps);
var fw = l("seed", (t, e) => Lf(() => t, e));
var W = j((t, e) => K(t, 1, e.randSeed));
var hw = W.toBipolar();
var Oe = (t) => W.fmap((e) => e < t);
var dw = (t) => d(t).fmap(Oe).innerJoin();
var mw = Oe(0.5);
var ze = (t) => W.fmap((e) => Math.trunc(e * t));
var yw = (t) => d(t).fmap(ze).innerJoin();
var Me = (t, e) => (e = e.map(d), e.length == 0 ? q : t.range(0, e.length).fmap((n) => {
  const s = Math.min(Math.max(Math.floor(n), 0), e.length - 1);
  return e[s];
}));
var It = (t, e) => Me(t, e).outerJoin();
var Pe = (t, e) => Me(t, e).innerJoin();
var Rf = (...t) => It(W, t);
var ww = (...t) => Pe(W, t);
var gw = Rf;
f.prototype.choose = function(...t) {
  return It(this, t);
};
f.prototype.choose2 = function(...t) {
  return It(this.fromBipolar(), t);
};
var Wf = (...t) => Pe(W.segment(1), t);
var bw = Wf;
var Ee = function(t, ...e) {
  const n = e.map((a) => d(a[0])), s = [];
  let r = C(0);
  for (const a of e)
    r = r.add(a[1]), s.push(r);
  const o = En(s), i2 = function(a) {
    const u = r.mul(a);
    return o.fmap((p) => (h) => n[p.findIndex((y) => y > h, p)]).appLeft(u);
  };
  return t.bind(i2);
};
var Ff = (...t) => Ee(...t).outerJoin();
var _w = (...t) => Ff(W, ...t);
var If = (...t) => Ee(W.segment(1), ...t).innerJoin();
var vw = If;
function Vf(t, e = 0) {
  let n = Math.floor(t), s = n + 1;
  const r = (p) => 6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3, o = (p) => (h) => (y) => h + r(p) * (y - h), i2 = K(n, 1, e), a = K(s, 1, e);
  return o(t - n)(i2)(a);
}
function Hf(t, e = 0) {
  const n = Math.floor(t), s = n + 1, r = K(n, 1, e), o = K(s, 1, e), i2 = r + o, a = (t - n) / (s - n);
  return ((p, h, y) => p + y * (h - p))(r, i2, a) / 2;
}
var kw = j((t, e) => Vf(t, e.randSeed));
var qw = j((t, e) => Hf(t, e.randSeed));
var Sw = l(
  "degradeByWith",
  (t, e, n) => n.fmap((s) => (r) => s).appLeft(t.filterValues((s) => s > e)),
  true,
  true
);
var Aw = l(
  "degradeBy",
  function(t, e) {
    return e._degradeByWith(W, t);
  },
  true,
  true
);
var Tw = l("degrade", (t) => t._degradeBy(0.5), true, true);
var Cw = l(
  "undegradeBy",
  function(t, e) {
    return e._degradeByWith(
      W.fmap((n) => 1 - n),
      t
    );
  },
  true,
  true
);
var xw = l("undegrade", (t) => t._undegradeBy(0.5), true, true);
var Bw = l("sometimesBy", function(t, e, n) {
  return d(t).fmap((s) => z(n._degradeBy(s), e(n._undegradeBy(1 - s)))).innerJoin();
});
var Ow = l("sometimes", function(t, e) {
  return e._sometimesBy(0.5, t);
});
var zw = l("someCyclesBy", function(t, e, n) {
  return d(t).fmap(
    (s) => z(
      n._degradeByWith(W._segment(1), s),
      e(n._degradeByWith(W.fmap((r) => 1 - r)._segment(1), 1 - s))
    )
  ).innerJoin();
});
var Mw = l("someCycles", function(t, e) {
  return e._someCyclesBy(0.5, t);
});
var Pw = l("often", function(t, e) {
  return e.sometimesBy(0.75, t);
});
var Ew = l("rarely", function(t, e) {
  return e.sometimesBy(0.25, t);
});
var jw = l("almostNever", function(t, e) {
  return e.sometimesBy(0.1, t);
});
var Jw = l("almostAlways", function(t, e) {
  return e.sometimesBy(0.9, t);
});
var $w = l("never", function(t, e) {
  return e;
});
var Nw = l("always", function(t, e) {
  return t(e);
});
function je(t) {
  Array.isArray(t) === false && (t = [t]);
  const e = qn();
  return t.every((n) => {
    const s = kn.get(n) ?? n;
    return e[s];
  });
}
var Lw = l("whenKey", function(t, e, n) {
  return n.when(je(t), e);
});
var Rw = l("keyDown", function(t) {
  return t.fmap(je);
});
var Ww = new f(function(t) {
  return [new S(void 0, t.span, t.span.duration)];
});
var Df = new f(function(t) {
  return [new S(void 0, t.span, m(1).div(t.span.duration))];
});
var Fw = Df;
var Iw = new f(function(t) {
  const e = m(1).div(t.span.duration);
  return [new S(void 0, t.span, Math.log(e) / Math.log(2) + 1)];
});
var wt;
try {
  wt = window?.speechSynthesis;
} catch {
  console.warn("cannot use window: not in browser?");
}
var re = wt?.getVoices();
function Gf(t, e, n) {
  wt.cancel();
  const s = new SpeechSynthesisUtterance(t);
  s.lang = e, re = wt.getVoices();
  const r = re.filter((o) => o.lang.includes(e));
  typeof n == "number" ? s.voice = r[n % r.length] : typeof n == "string" && (s.voice = r.find((o) => o.name === o)), speechSynthesis.speak(s);
}
var Vw = l("speak", function(t, e, n) {
  return n.onTrigger((s) => {
    Gf(s.value, t, e);
  });
});
var Hw = function(t, e = {}) {
  const n = document.getElementById("code"), s = "background-image:url(" + t + ");background-size:contain;";
  n.style = s;
  const { className: r } = n, o = (u, p) => {
    ({
      style: () => n.style = s + ";" + p,
      className: () => n.className = p + " " + r
    })[u]();
  }, i2 = Object.entries(e).filter(([u, p]) => typeof p == "function");
  Object.entries(e).filter(([u, p]) => typeof p == "string").forEach(([u, p]) => o(u, p)), i2.length;
};
var Dw = () => {
  const t = document.getElementById("code");
  t && (t.style = "");
};
E("\u{1F300} @strudel/core loaded \u{1F300}");
globalThis._strudelLoaded && console.warn(
  `@strudel/core was loaded more than once...
This might happen when you have multiple versions of strudel installed. 
Please check with "npm ls @strudel/core".`
);
globalThis._strudelLoaded = true;

// node_modules/@strudel/mini/dist/index.mjs
var dist_exports2 = {};
__export(dist_exports2, {
  StartRules: () => Gr2,
  SyntaxError: () => uu2,
  getLeafLocation: () => ee2,
  getLeafLocations: () => Yr2,
  getLeaves: () => Xr2,
  h: () => Jr2,
  m: () => Hr2,
  mini: () => te2,
  mini2ast: () => Au2,
  miniAllStrings: () => Qr2,
  minify: () => Kr2,
  parse: () => Mr2,
  patternifyAST: () => nu2
});
function Or2(t, i2) {
  function e() {
    this.constructor = t;
  }
  e.prototype = i2.prototype, t.prototype = new e();
}
function uu2(t, i2, e, f2) {
  var l2 = Error.call(this, t);
  return Object.setPrototypeOf && Object.setPrototypeOf(l2, uu2.prototype), l2.expected = i2, l2.found = e, l2.location = f2, l2.name = "SyntaxError", l2;
}
Or2(uu2, Error);
function Cu2(t, i2, e) {
  return e = e || " ", t.length > i2 ? t : (i2 -= t.length, e += e.repeat(i2), t + e.slice(0, i2));
}
uu2.prototype.format = function(t) {
  var i2 = "Error: " + this.message;
  if (this.location) {
    var e = null, f2;
    for (f2 = 0; f2 < t.length; f2++)
      if (t[f2].source === this.location.source) {
        e = t[f2].text.split(/\r\n|\n|\r/g);
        break;
      }
    var l2 = this.location.start, a = this.location.source && typeof this.location.source.offset == "function" ? this.location.source.offset(l2) : l2, D2 = this.location.source + ":" + a.line + ":" + a.column;
    if (e) {
      var v = this.location.end, g = Cu2("", a.line.toString().length, " "), c2 = e[l2.line - 1], F3 = l2.line === v.line ? v.column : c2.length + 1, p = F3 - l2.column || 1;
      i2 += `
 --> ` + D2 + `
` + g + ` |
` + a.line + " | " + c2 + `
` + g + " | " + Cu2("", l2.column - 1, " ") + Cu2("", p, "^");
    } else
      i2 += `
 at ` + D2;
  }
  return i2;
};
uu2.buildMessage = function(t, i2) {
  var e = {
    literal: function(c2) {
      return '"' + l2(c2.text) + '"';
    },
    class: function(c2) {
      var F3 = c2.parts.map(function(p) {
        return Array.isArray(p) ? a(p[0]) + "-" + a(p[1]) : a(p);
      });
      return "[" + (c2.inverted ? "^" : "") + F3.join("") + "]";
    },
    any: function() {
      return "any character";
    },
    end: function() {
      return "end of input";
    },
    other: function(c2) {
      return c2.description;
    }
  };
  function f2(c2) {
    return c2.charCodeAt(0).toString(16).toUpperCase();
  }
  function l2(c2) {
    return c2.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(F3) {
      return "\\x0" + f2(F3);
    }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(F3) {
      return "\\x" + f2(F3);
    });
  }
  function a(c2) {
    return c2.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(F3) {
      return "\\x0" + f2(F3);
    }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(F3) {
      return "\\x" + f2(F3);
    });
  }
  function D2(c2) {
    return e[c2.type](c2);
  }
  function v(c2) {
    var F3 = c2.map(D2), p, w2;
    if (F3.sort(), F3.length > 0) {
      for (p = 1, w2 = 1; p < F3.length; p++)
        F3[p - 1] !== F3[p] && (F3[w2] = F3[p], w2++);
      F3.length = w2;
    }
    switch (F3.length) {
      case 1:
        return F3[0];
      case 2:
        return F3[0] + " or " + F3[1];
      default:
        return F3.slice(0, -1).join(", ") + ", or " + F3[F3.length - 1];
    }
  }
  function g(c2) {
    return c2 ? '"' + l2(c2) + '"' : "end of input";
  }
  return "Expected " + v(t) + " but " + g(i2) + " found.";
};
function Mr2(t, i2) {
  i2 = i2 !== void 0 ? i2 : {};
  var e = {}, f2 = i2.grammarSource, l2 = { start: Uu2 }, a = Uu2, D2 = ".", v = "-", g = "0", c2 = ",", F3 = "|", p = "[", w2 = "]", P3 = "{", R3 = "}", su2 = "%", iu2 = "<", re3 = ">", ne3 = "!", se3 = "(", ie3 = ")", fe2 = "/", oe3 = "*", ae3 = "?", le3 = ":", Eu2 = "..", ce3 = "^", vu2 = "struct", $u2 = "target", mu2 = "euclid", _u2 = "slow", yu2 = "rotL", wu2 = "rotR", bu2 = "fast", xu2 = "scale", Iu2 = "//", ku2 = "cat", Ae2 = "$", Nu2 = "setcps", Pu2 = "setbpm", qu2 = "hush", pe3 = /^[1-9]/, ge2 = /^[eE]/, Fe = /^[+\-]/, he2 = /^[0-9]/, ju2 = /^[ \n\r\t\xA0]/, Be2 = /^["']/, Ce2 = /^[#\--.0-9A-Z\^-_a-z~\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376-\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06E5-\u06E6\u06EE-\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4-\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F-\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC-\u09DD\u09DF-\u09E1\u09F0-\u09F1\u09FC\u0A05-\u0A0A\u0A0F-\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32-\u0A33\u0A35-\u0A36\u0A38-\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2-\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0-\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F-\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32-\u0B33\u0B35-\u0B39\u0B3D\u0B5C-\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99-\u0B9A\u0B9C\u0B9E-\u0B9F\u0BA3-\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60-\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0-\u0CE1\u0CF1-\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32-\u0E33\u0E40-\u0E46\u0E81-\u0E82\u0E84\u0E87-\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA-\u0EAB\u0EAD-\u0EB0\u0EB2-\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065-\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE-\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5-\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEF\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A-\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7B9\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD-\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5-\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40-\uFB41\uFB43-\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/, De = /^[@_]/, Su2 = /^[^\n]/, de2 = pu2("number"), Ru2 = _2(".", false), Ee2 = O([["1", "9"]], false, false), ve2 = O(["e", "E"], false, false), $e = O(["+", "-"], false, false), me2 = _2("-", false), _e2 = _2("0", false), ye2 = O([["0", "9"]], false, false), we2 = pu2("whitespace"), Lu2 = O([" ", `
`, "\r", "	", "\xA0"], false, false), be2 = _2(",", false), xe2 = _2("|", false), Ie = O(['"', "'"], false, false), ke2 = pu2('a letter, a number, "-", "#", ".", "^", "_"'), Ne = O(["#", ["-", "."], ["0", "9"], ["A", "Z"], ["^", "_"], ["a", "z"], "~", "\xAA", "\xB5", "\xBA", ["\xC0", "\xD6"], ["\xD8", "\xF6"], ["\xF8", "\u02C1"], ["\u02C6", "\u02D1"], ["\u02E0", "\u02E4"], "\u02EC", "\u02EE", ["\u0370", "\u0374"], ["\u0376", "\u0377"], ["\u037A", "\u037D"], "\u037F", "\u0386", ["\u0388", "\u038A"], "\u038C", ["\u038E", "\u03A1"], ["\u03A3", "\u03F5"], ["\u03F7", "\u0481"], ["\u048A", "\u052F"], ["\u0531", "\u0556"], "\u0559", ["\u0560", "\u0588"], ["\u05D0", "\u05EA"], ["\u05EF", "\u05F2"], ["\u0620", "\u064A"], ["\u066E", "\u066F"], ["\u0671", "\u06D3"], "\u06D5", ["\u06E5", "\u06E6"], ["\u06EE", "\u06EF"], ["\u06FA", "\u06FC"], "\u06FF", "\u0710", ["\u0712", "\u072F"], ["\u074D", "\u07A5"], "\u07B1", ["\u07CA", "\u07EA"], ["\u07F4", "\u07F5"], "\u07FA", ["\u0800", "\u0815"], "\u081A", "\u0824", "\u0828", ["\u0840", "\u0858"], ["\u0860", "\u086A"], ["\u08A0", "\u08B4"], ["\u08B6", "\u08BD"], ["\u0904", "\u0939"], "\u093D", "\u0950", ["\u0958", "\u0961"], ["\u0971", "\u0980"], ["\u0985", "\u098C"], ["\u098F", "\u0990"], ["\u0993", "\u09A8"], ["\u09AA", "\u09B0"], "\u09B2", ["\u09B6", "\u09B9"], "\u09BD", "\u09CE", ["\u09DC", "\u09DD"], ["\u09DF", "\u09E1"], ["\u09F0", "\u09F1"], "\u09FC", ["\u0A05", "\u0A0A"], ["\u0A0F", "\u0A10"], ["\u0A13", "\u0A28"], ["\u0A2A", "\u0A30"], ["\u0A32", "\u0A33"], ["\u0A35", "\u0A36"], ["\u0A38", "\u0A39"], ["\u0A59", "\u0A5C"], "\u0A5E", ["\u0A72", "\u0A74"], ["\u0A85", "\u0A8D"], ["\u0A8F", "\u0A91"], ["\u0A93", "\u0AA8"], ["\u0AAA", "\u0AB0"], ["\u0AB2", "\u0AB3"], ["\u0AB5", "\u0AB9"], "\u0ABD", "\u0AD0", ["\u0AE0", "\u0AE1"], "\u0AF9", ["\u0B05", "\u0B0C"], ["\u0B0F", "\u0B10"], ["\u0B13", "\u0B28"], ["\u0B2A", "\u0B30"], ["\u0B32", "\u0B33"], ["\u0B35", "\u0B39"], "\u0B3D", ["\u0B5C", "\u0B5D"], ["\u0B5F", "\u0B61"], "\u0B71", "\u0B83", ["\u0B85", "\u0B8A"], ["\u0B8E", "\u0B90"], ["\u0B92", "\u0B95"], ["\u0B99", "\u0B9A"], "\u0B9C", ["\u0B9E", "\u0B9F"], ["\u0BA3", "\u0BA4"], ["\u0BA8", "\u0BAA"], ["\u0BAE", "\u0BB9"], "\u0BD0", ["\u0C05", "\u0C0C"], ["\u0C0E", "\u0C10"], ["\u0C12", "\u0C28"], ["\u0C2A", "\u0C39"], "\u0C3D", ["\u0C58", "\u0C5A"], ["\u0C60", "\u0C61"], "\u0C80", ["\u0C85", "\u0C8C"], ["\u0C8E", "\u0C90"], ["\u0C92", "\u0CA8"], ["\u0CAA", "\u0CB3"], ["\u0CB5", "\u0CB9"], "\u0CBD", "\u0CDE", ["\u0CE0", "\u0CE1"], ["\u0CF1", "\u0CF2"], ["\u0D05", "\u0D0C"], ["\u0D0E", "\u0D10"], ["\u0D12", "\u0D3A"], "\u0D3D", "\u0D4E", ["\u0D54", "\u0D56"], ["\u0D5F", "\u0D61"], ["\u0D7A", "\u0D7F"], ["\u0D85", "\u0D96"], ["\u0D9A", "\u0DB1"], ["\u0DB3", "\u0DBB"], "\u0DBD", ["\u0DC0", "\u0DC6"], ["\u0E01", "\u0E30"], ["\u0E32", "\u0E33"], ["\u0E40", "\u0E46"], ["\u0E81", "\u0E82"], "\u0E84", ["\u0E87", "\u0E88"], "\u0E8A", "\u0E8D", ["\u0E94", "\u0E97"], ["\u0E99", "\u0E9F"], ["\u0EA1", "\u0EA3"], "\u0EA5", "\u0EA7", ["\u0EAA", "\u0EAB"], ["\u0EAD", "\u0EB0"], ["\u0EB2", "\u0EB3"], "\u0EBD", ["\u0EC0", "\u0EC4"], "\u0EC6", ["\u0EDC", "\u0EDF"], "\u0F00", ["\u0F40", "\u0F47"], ["\u0F49", "\u0F6C"], ["\u0F88", "\u0F8C"], ["\u1000", "\u102A"], "\u103F", ["\u1050", "\u1055"], ["\u105A", "\u105D"], "\u1061", ["\u1065", "\u1066"], ["\u106E", "\u1070"], ["\u1075", "\u1081"], "\u108E", ["\u10A0", "\u10C5"], "\u10C7", "\u10CD", ["\u10D0", "\u10FA"], ["\u10FC", "\u1248"], ["\u124A", "\u124D"], ["\u1250", "\u1256"], "\u1258", ["\u125A", "\u125D"], ["\u1260", "\u1288"], ["\u128A", "\u128D"], ["\u1290", "\u12B0"], ["\u12B2", "\u12B5"], ["\u12B8", "\u12BE"], "\u12C0", ["\u12C2", "\u12C5"], ["\u12C8", "\u12D6"], ["\u12D8", "\u1310"], ["\u1312", "\u1315"], ["\u1318", "\u135A"], ["\u1380", "\u138F"], ["\u13A0", "\u13F5"], ["\u13F8", "\u13FD"], ["\u1401", "\u166C"], ["\u166F", "\u167F"], ["\u1681", "\u169A"], ["\u16A0", "\u16EA"], ["\u16EE", "\u16F8"], ["\u1700", "\u170C"], ["\u170E", "\u1711"], ["\u1720", "\u1731"], ["\u1740", "\u1751"], ["\u1760", "\u176C"], ["\u176E", "\u1770"], ["\u1780", "\u17B3"], "\u17D7", "\u17DC", ["\u1820", "\u1878"], ["\u1880", "\u1884"], ["\u1887", "\u18A8"], "\u18AA", ["\u18B0", "\u18F5"], ["\u1900", "\u191E"], ["\u1950", "\u196D"], ["\u1970", "\u1974"], ["\u1980", "\u19AB"], ["\u19B0", "\u19C9"], ["\u1A00", "\u1A16"], ["\u1A20", "\u1A54"], "\u1AA7", ["\u1B05", "\u1B33"], ["\u1B45", "\u1B4B"], ["\u1B83", "\u1BA0"], ["\u1BAE", "\u1BAF"], ["\u1BBA", "\u1BE5"], ["\u1C00", "\u1C23"], ["\u1C4D", "\u1C4F"], ["\u1C5A", "\u1C7D"], ["\u1C80", "\u1C88"], ["\u1C90", "\u1CBA"], ["\u1CBD", "\u1CBF"], ["\u1CE9", "\u1CEC"], ["\u1CEE", "\u1CF1"], ["\u1CF5", "\u1CF6"], ["\u1D00", "\u1DBF"], ["\u1E00", "\u1F15"], ["\u1F18", "\u1F1D"], ["\u1F20", "\u1F45"], ["\u1F48", "\u1F4D"], ["\u1F50", "\u1F57"], "\u1F59", "\u1F5B", "\u1F5D", ["\u1F5F", "\u1F7D"], ["\u1F80", "\u1FB4"], ["\u1FB6", "\u1FBC"], "\u1FBE", ["\u1FC2", "\u1FC4"], ["\u1FC6", "\u1FCC"], ["\u1FD0", "\u1FD3"], ["\u1FD6", "\u1FDB"], ["\u1FE0", "\u1FEC"], ["\u1FF2", "\u1FF4"], ["\u1FF6", "\u1FFC"], "\u2071", "\u207F", ["\u2090", "\u209C"], "\u2102", "\u2107", ["\u210A", "\u2113"], "\u2115", ["\u2119", "\u211D"], "\u2124", "\u2126", "\u2128", ["\u212A", "\u212D"], ["\u212F", "\u2139"], ["\u213C", "\u213F"], ["\u2145", "\u2149"], "\u214E", ["\u2160", "\u2188"], ["\u2C00", "\u2C2E"], ["\u2C30", "\u2C5E"], ["\u2C60", "\u2CE4"], ["\u2CEB", "\u2CEE"], ["\u2CF2", "\u2CF3"], ["\u2D00", "\u2D25"], "\u2D27", "\u2D2D", ["\u2D30", "\u2D67"], "\u2D6F", ["\u2D80", "\u2D96"], ["\u2DA0", "\u2DA6"], ["\u2DA8", "\u2DAE"], ["\u2DB0", "\u2DB6"], ["\u2DB8", "\u2DBE"], ["\u2DC0", "\u2DC6"], ["\u2DC8", "\u2DCE"], ["\u2DD0", "\u2DD6"], ["\u2DD8", "\u2DDE"], "\u2E2F", ["\u3005", "\u3007"], ["\u3021", "\u3029"], ["\u3031", "\u3035"], ["\u3038", "\u303C"], ["\u3041", "\u3096"], ["\u309D", "\u309F"], ["\u30A1", "\u30FA"], ["\u30FC", "\u30FF"], ["\u3105", "\u312F"], ["\u3131", "\u318E"], ["\u31A0", "\u31BA"], ["\u31F0", "\u31FF"], ["\u3400", "\u4DB5"], ["\u4E00", "\u9FEF"], ["\uA000", "\uA48C"], ["\uA4D0", "\uA4FD"], ["\uA500", "\uA60C"], ["\uA610", "\uA61F"], ["\uA62A", "\uA62B"], ["\uA640", "\uA66E"], ["\uA67F", "\uA69D"], ["\uA6A0", "\uA6EF"], ["\uA717", "\uA71F"], ["\uA722", "\uA788"], ["\uA78B", "\uA7B9"], ["\uA7F7", "\uA801"], ["\uA803", "\uA805"], ["\uA807", "\uA80A"], ["\uA80C", "\uA822"], ["\uA840", "\uA873"], ["\uA882", "\uA8B3"], ["\uA8F2", "\uA8F7"], "\uA8FB", ["\uA8FD", "\uA8FE"], ["\uA90A", "\uA925"], ["\uA930", "\uA946"], ["\uA960", "\uA97C"], ["\uA984", "\uA9B2"], "\uA9CF", ["\uA9E0", "\uA9E4"], ["\uA9E6", "\uA9EF"], ["\uA9FA", "\uA9FE"], ["\uAA00", "\uAA28"], ["\uAA40", "\uAA42"], ["\uAA44", "\uAA4B"], ["\uAA60", "\uAA76"], "\uAA7A", ["\uAA7E", "\uAAAF"], "\uAAB1", ["\uAAB5", "\uAAB6"], ["\uAAB9", "\uAABD"], "\uAAC0", "\uAAC2", ["\uAADB", "\uAADD"], ["\uAAE0", "\uAAEA"], ["\uAAF2", "\uAAF4"], ["\uAB01", "\uAB06"], ["\uAB09", "\uAB0E"], ["\uAB11", "\uAB16"], ["\uAB20", "\uAB26"], ["\uAB28", "\uAB2E"], ["\uAB30", "\uAB5A"], ["\uAB5C", "\uAB65"], ["\uAB70", "\uABE2"], ["\uAC00", "\uD7A3"], ["\uD7B0", "\uD7C6"], ["\uD7CB", "\uD7FB"], ["\uF900", "\uFA6D"], ["\uFA70", "\uFAD9"], ["\uFB00", "\uFB06"], ["\uFB13", "\uFB17"], "\uFB1D", ["\uFB1F", "\uFB28"], ["\uFB2A", "\uFB36"], ["\uFB38", "\uFB3C"], "\uFB3E", ["\uFB40", "\uFB41"], ["\uFB43", "\uFB44"], ["\uFB46", "\uFBB1"], ["\uFBD3", "\uFD3D"], ["\uFD50", "\uFD8F"], ["\uFD92", "\uFDC7"], ["\uFDF0", "\uFDFB"], ["\uFE70", "\uFE74"], ["\uFE76", "\uFEFC"], ["\uFF21", "\uFF3A"], ["\uFF41", "\uFF5A"], ["\uFF66", "\uFFBE"], ["\uFFC2", "\uFFC7"], ["\uFFCA", "\uFFCF"], ["\uFFD2", "\uFFD7"], ["\uFFDA", "\uFFDC"]], false, false), Ou2 = _2("[", false), Mu2 = _2("]", false), Pe2 = _2("{", false), qe2 = _2("}", false), je2 = _2("%", false), Se2 = _2("<", false), Re = _2(">", false), Le = O(["@", "_"], false, false), Oe2 = _2("!", false), Me2 = _2("(", false), ze2 = _2(")", false), Te2 = _2("/", false), Ze2 = _2("*", false), We = _2("?", false), Ue2 = _2(":", false), Ve = _2("..", false), Xe2 = _2("^", false), Ge = _2("struct", false), Ye2 = _2("target", false), He = _2("euclid", false), Je = _2("slow", false), Ke2 = _2("rotL", false), Qe2 = _2("rotR", false), ut2 = _2("fast", false), et2 = _2("scale", false), tt = _2("//", false), zu2 = O([`
`], true, false), rt2 = _2("cat", false), nt = _2("$", false), st = _2("setcps", false), it2 = _2("setbpm", false), ft = _2("hush", false), ot2 = function() {
    return parseFloat(Xt2());
  }, at3 = function(u) {
    const r = u.join("");
    return r === "." || r === "_";
  }, lt2 = function(u) {
    return new Sr2(u.join(""));
  }, ct2 = function(u) {
    return u;
  }, At = function(u, r) {
    return u.arguments_.stepsPerCycle = r, u;
  }, pt2 = function(u) {
    return u;
  }, gt2 = function(u) {
    return u.arguments_.alignment = "polymeter_slowcat", u;
  }, Ft2 = function(u) {
    return (r) => r.options_.weight = (r.options_.weight ?? 1) + (u ?? 2) - 1;
  }, ht = function(u) {
    return (r) => {
      const s = (r.options_.reps ?? 1) + (u ?? 2) - 1;
      r.options_.reps = s, r.options_.ops = r.options_.ops.filter((o) => o.type_ !== "replicate"), r.options_.ops.push({ type_: "replicate", arguments_: { amount: s } }), r.options_.weight = s;
    };
  }, Bt2 = function(u, r, s) {
    return (o) => o.options_.ops.push({ type_: "bjorklund", arguments_: { pulse: u, step: r, rotation: s } });
  }, Ct2 = function(u) {
    return (r) => r.options_.ops.push({ type_: "stretch", arguments_: { amount: u, type: "slow" } });
  }, Dt = function(u) {
    return (r) => r.options_.ops.push({ type_: "stretch", arguments_: { amount: u, type: "fast" } });
  }, dt2 = function(u) {
    return (r) => r.options_.ops.push({ type_: "degradeBy", arguments_: { amount: u, seed: Bu2++ } });
  }, Et2 = function(u) {
    return (r) => r.options_.ops.push({ type_: "tail", arguments_: { element: u } });
  }, vt2 = function(u) {
    return (r) => r.options_.ops.push({ type_: "range", arguments_: { element: u } });
  }, $t2 = function(u, r) {
    const s = new Lr2(u, { ops: [], weight: 1, reps: 1 });
    for (const o of r)
      o(s);
    return s;
  }, mt2 = function(u, r) {
    return new lu2(r, "fastcat", void 0, !!u);
  }, _t2 = function(u) {
    return { alignment: "stack", list: u };
  }, yt2 = function(u) {
    return { alignment: "rand", list: u, seed: Bu2++ };
  }, wt2 = function(u) {
    return { alignment: "feet", list: u, seed: Bu2++ };
  }, bt2 = function(u, r) {
    return r && r.list.length > 0 ? new lu2([u, ...r.list], r.alignment, r.seed) : u;
  }, xt2 = function(u, r) {
    return new lu2(r ? [u, ...r.list] : [u], "polymeter");
  }, It2 = function(u) {
    return u;
  }, kt2 = function(u) {
    return { name: "struct", args: { mini: u } };
  }, Nt2 = function(u) {
    return { name: "target", args: { name: u } };
  }, Pt2 = function(u, r, s) {
    return { name: "bjorklund", args: { pulse: u, step: parseInt(r) } };
  }, qt2 = function(u) {
    return { name: "stretch", args: { amount: u } };
  }, jt2 = function(u) {
    return { name: "shift", args: { amount: "-" + u } };
  }, St = function(u) {
    return { name: "shift", args: { amount: u } };
  }, Rt2 = function(u) {
    return { name: "stretch", args: { amount: "1/" + u } };
  }, Lt2 = function(u) {
    return { name: "scale", args: { scale: u.join("") } };
  }, Tu2 = function(u, r) {
    return r;
  }, Ot2 = function(u, r) {
    return r.unshift(u), new lu2(r, "slowcat");
  }, Mt2 = function(u) {
    return u;
  }, zt2 = function(u, r) {
    return new Rr2(u.name, u.args, r);
  }, Tt = function(u) {
    return u;
  }, Zt2 = function(u) {
    return u;
  }, Wt2 = function(u) {
    return new hu2("setcps", { value: u });
  }, Ut2 = function(u) {
    return new hu2("setcps", { value: u / 120 / 2 });
  }, Vt = function() {
    return new hu2("hush");
  }, n = i2.peg$currPos | 0, $2 = n, V3 = [{ line: 1, column: 1 }], q3 = n, fu2 = i2.peg$maxFailExpected || [], h = i2.peg$silentFails | 0, eu2;
  if (i2.startRule) {
    if (!(i2.startRule in l2))
      throw new Error(`Can't start parsing from rule "` + i2.startRule + '".');
    a = l2[i2.startRule];
  }
  function Xt2() {
    return t.substring($2, n);
  }
  function Zu2() {
    return gu2($2, n);
  }
  function _2(u, r) {
    return { type: "literal", text: u, ignoreCase: r };
  }
  function O(u, r, s) {
    return { type: "class", parts: u, inverted: r, ignoreCase: s };
  }
  function Gt() {
    return { type: "end" };
  }
  function pu2(u) {
    return { type: "other", description: u };
  }
  function Wu2(u) {
    var r = V3[u], s;
    if (r)
      return r;
    if (u >= V3.length)
      s = V3.length - 1;
    else
      for (s = u; !V3[--s]; )
        ;
    for (r = V3[s], r = {
      line: r.line,
      column: r.column
    }; s < u; )
      t.charCodeAt(s) === 10 ? (r.line++, r.column = 1) : r.column++, s++;
    return V3[u] = r, r;
  }
  function gu2(u, r, s) {
    var o = Wu2(u), B3 = Wu2(r), x = {
      source: f2,
      start: {
        offset: u,
        line: o.line,
        column: o.column
      },
      end: {
        offset: r,
        line: B3.line,
        column: B3.column
      }
    };
    return x;
  }
  function d2(u) {
    n < q3 || (n > q3 && (q3 = n, fu2 = []), fu2.push(u));
  }
  function Yt2(u, r, s) {
    return new uu2(
      uu2.buildMessage(u, r),
      u,
      r,
      s
    );
  }
  function Uu2() {
    var u;
    return u = jr2(), u;
  }
  function M() {
    var u, r;
    return h++, u = n, er2(), r = ou2(), r !== e ? (ur2(), Qt(), $2 = u, u = ot2()) : (n = u, u = e), h--, u === e && h === 0 && d2(de2), u;
  }
  function Ht() {
    var u;
    return t.charCodeAt(n) === 46 ? (u = D2, n++) : (u = e, h === 0 && d2(Ru2)), u;
  }
  function Jt2() {
    var u;
    return u = t.charAt(n), pe3.test(u) ? n++ : (u = e, h === 0 && d2(Ee2)), u;
  }
  function Kt2() {
    var u;
    return u = t.charAt(n), ge2.test(u) ? n++ : (u = e, h === 0 && d2(ve2)), u;
  }
  function Qt() {
    var u, r, s, o, B3;
    if (u = n, r = Kt2(), r !== e) {
      if (s = t.charAt(n), Fe.test(s) ? n++ : (s = e, h === 0 && d2($e)), s === e && (s = null), o = [], B3 = X2(), B3 !== e)
        for (; B3 !== e; )
          o.push(B3), B3 = X2();
      else
        o = e;
      o !== e ? (r = [r, s, o], u = r) : (n = u, u = e);
    } else
      n = u, u = e;
    return u;
  }
  function ur2() {
    var u, r, s, o;
    if (u = n, r = Ht(), r !== e) {
      if (s = [], o = X2(), o !== e)
        for (; o !== e; )
          s.push(o), o = X2();
      else
        s = e;
      s !== e ? (r = [r, s], u = r) : (n = u, u = e);
    } else
      n = u, u = e;
    return u;
  }
  function ou2() {
    var u, r, s, o;
    if (u = tr2(), u === e)
      if (u = n, r = Jt2(), r !== e) {
        for (s = [], o = X2(); o !== e; )
          s.push(o), o = X2();
        r = [r, s], u = r;
      } else
        n = u, u = e;
    return u;
  }
  function er2() {
    var u;
    return t.charCodeAt(n) === 45 ? (u = v, n++) : (u = e, h === 0 && d2(me2)), u;
  }
  function tr2() {
    var u;
    return t.charCodeAt(n) === 48 ? (u = g, n++) : (u = e, h === 0 && d2(_e2)), u;
  }
  function X2() {
    var u;
    return u = t.charAt(n), he2.test(u) ? n++ : (u = e, h === 0 && d2(ye2)), u;
  }
  function E3() {
    var u, r;
    for (h++, u = [], r = t.charAt(n), ju2.test(r) ? n++ : (r = e, h === 0 && d2(Lu2)); r !== e; )
      u.push(r), r = t.charAt(n), ju2.test(r) ? n++ : (r = e, h === 0 && d2(Lu2));
    return h--, r = e, h === 0 && d2(we2), u;
  }
  function G3() {
    var u, r, s, o;
    return u = n, r = E3(), t.charCodeAt(n) === 44 ? (s = c2, n++) : (s = e, h === 0 && d2(be2)), s !== e ? (o = E3(), r = [r, s, o], u = r) : (n = u, u = e), u;
  }
  function Vu2() {
    var u, r, s, o;
    return u = n, r = E3(), t.charCodeAt(n) === 124 ? (s = F3, n++) : (s = e, h === 0 && d2(xe2)), s !== e ? (o = E3(), r = [r, s, o], u = r) : (n = u, u = e), u;
  }
  function Xu2() {
    var u, r, s, o;
    return u = n, r = E3(), t.charCodeAt(n) === 46 ? (s = D2, n++) : (s = e, h === 0 && d2(Ru2)), s !== e ? (o = E3(), r = [r, s, o], u = r) : (n = u, u = e), u;
  }
  function Y3() {
    var u;
    return u = t.charAt(n), Be2.test(u) ? n++ : (u = e, h === 0 && d2(Ie)), u;
  }
  function au2() {
    var u;
    return h++, u = t.charAt(n), Ce2.test(u) ? n++ : (u = e, h === 0 && d2(Ne)), h--, u === e && h === 0 && d2(ke2), u;
  }
  function Gu2() {
    var u, r, s, o;
    if (u = n, E3(), r = [], s = au2(), s !== e)
      for (; s !== e; )
        r.push(s), s = au2();
    else
      r = e;
    return r !== e ? (s = E3(), $2 = n, o = at3(r), o ? o = e : o = void 0, o !== e ? ($2 = u, u = lt2(r)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function rr2() {
    var u, r, s, o;
    return u = n, E3(), t.charCodeAt(n) === 91 ? (r = p, n++) : (r = e, h === 0 && d2(Ou2)), r !== e ? (E3(), s = Ju2(), s !== e ? (E3(), t.charCodeAt(n) === 93 ? (o = w2, n++) : (o = e, h === 0 && d2(Mu2)), o !== e ? (E3(), $2 = u, u = ct2(s)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function nr2() {
    var u, r, s, o, B3;
    return u = n, E3(), t.charCodeAt(n) === 123 ? (r = P3, n++) : (r = e, h === 0 && d2(Pe2)), r !== e ? (E3(), s = Ku2(), s !== e ? (E3(), t.charCodeAt(n) === 125 ? (o = R3, n++) : (o = e, h === 0 && d2(qe2)), o !== e ? (B3 = sr2(), B3 === e && (B3 = null), E3(), $2 = u, u = At(s, B3)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function sr2() {
    var u, r, s;
    return u = n, t.charCodeAt(n) === 37 ? (r = su2, n++) : (r = e, h === 0 && d2(je2)), r !== e ? (s = H2(), s !== e ? ($2 = u, u = pt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function ir2() {
    var u, r, s, o;
    return u = n, E3(), t.charCodeAt(n) === 60 ? (r = iu2, n++) : (r = e, h === 0 && d2(Se2)), r !== e ? (E3(), s = Ku2(), s !== e ? (E3(), t.charCodeAt(n) === 62 ? (o = re3, n++) : (o = e, h === 0 && d2(Re)), o !== e ? (E3(), $2 = u, u = gt2(s)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function H2() {
    var u;
    return u = Gu2(), u === e && (u = rr2(), u === e && (u = nr2(), u === e && (u = ir2()))), u;
  }
  function Yu2() {
    var u;
    return u = fr2(), u === e && (u = ar2(), u === e && (u = lr2(), u === e && (u = cr2(), u === e && (u = or2(), u === e && (u = Ar2(), u === e && (u = pr2(), u === e && (u = gr2()))))))), u;
  }
  function fr2() {
    var u, r, s;
    return u = n, E3(), r = t.charAt(n), De.test(r) ? n++ : (r = e, h === 0 && d2(Le)), r !== e ? (s = M(), s === e && (s = null), $2 = u, u = Ft2(s)) : (n = u, u = e), u;
  }
  function or2() {
    var u, r, s;
    return u = n, E3(), t.charCodeAt(n) === 33 ? (r = ne3, n++) : (r = e, h === 0 && d2(Oe2)), r !== e ? (s = M(), s === e && (s = null), $2 = u, u = ht(s)) : (n = u, u = e), u;
  }
  function ar2() {
    var u, r, s, o, B3, x, j3;
    return u = n, t.charCodeAt(n) === 40 ? (r = se3, n++) : (r = e, h === 0 && d2(Me2)), r !== e ? (E3(), s = tu2(), s !== e ? (E3(), o = G3(), o !== e ? (E3(), B3 = tu2(), B3 !== e ? (E3(), G3(), E3(), x = tu2(), x === e && (x = null), E3(), t.charCodeAt(n) === 41 ? (j3 = ie3, n++) : (j3 = e, h === 0 && d2(ze2)), j3 !== e ? ($2 = u, u = Bt2(s, B3, x)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function lr2() {
    var u, r, s;
    return u = n, t.charCodeAt(n) === 47 ? (r = fe2, n++) : (r = e, h === 0 && d2(Te2)), r !== e ? (s = H2(), s !== e ? ($2 = u, u = Ct2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function cr2() {
    var u, r, s;
    return u = n, t.charCodeAt(n) === 42 ? (r = oe3, n++) : (r = e, h === 0 && d2(Ze2)), r !== e ? (s = H2(), s !== e ? ($2 = u, u = Dt(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function Ar2() {
    var u, r, s;
    return u = n, t.charCodeAt(n) === 63 ? (r = ae3, n++) : (r = e, h === 0 && d2(We)), r !== e ? (s = M(), s === e && (s = null), $2 = u, u = dt2(s)) : (n = u, u = e), u;
  }
  function pr2() {
    var u, r, s;
    return u = n, t.charCodeAt(n) === 58 ? (r = le3, n++) : (r = e, h === 0 && d2(Ue2)), r !== e ? (s = H2(), s !== e ? ($2 = u, u = Et2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function gr2() {
    var u, r, s;
    return u = n, t.substr(n, 2) === Eu2 ? (r = Eu2, n += 2) : (r = e, h === 0 && d2(Ve)), r !== e ? (s = H2(), s !== e ? ($2 = u, u = vt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function tu2() {
    var u, r, s, o;
    if (u = n, r = H2(), r !== e) {
      for (s = [], o = Yu2(); o !== e; )
        s.push(o), o = Yu2();
      $2 = u, u = $t2(r, s);
    } else
      n = u, u = e;
    return u;
  }
  function T2() {
    var u, r, s, o;
    if (u = n, t.charCodeAt(n) === 94 ? (r = ce3, n++) : (r = e, h === 0 && d2(Xe2)), r === e && (r = null), s = [], o = tu2(), o !== e)
      for (; o !== e; )
        s.push(o), o = tu2();
    else
      s = e;
    return s !== e ? ($2 = u, u = mt2(r, s)) : (n = u, u = e), u;
  }
  function Hu2() {
    var u, r, s, o, B3;
    if (u = n, r = [], s = n, o = G3(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e), s !== e)
      for (; s !== e; )
        r.push(s), s = n, o = G3(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e);
    else
      r = e;
    return r !== e && ($2 = u, r = _t2(r)), u = r, u;
  }
  function Fr2() {
    var u, r, s, o, B3;
    if (u = n, r = [], s = n, o = Vu2(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e), s !== e)
      for (; s !== e; )
        r.push(s), s = n, o = Vu2(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e);
    else
      r = e;
    return r !== e && ($2 = u, r = yt2(r)), u = r, u;
  }
  function hr2() {
    var u, r, s, o, B3;
    if (u = n, r = [], s = n, o = Xu2(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e), s !== e)
      for (; s !== e; )
        r.push(s), s = n, o = Xu2(), o !== e ? (B3 = T2(), B3 !== e ? s = B3 : (n = s, s = e)) : (n = s, s = e);
    else
      r = e;
    return r !== e && ($2 = u, r = wt2(r)), u = r, u;
  }
  function Ju2() {
    var u, r, s;
    return u = n, r = T2(), r !== e ? (s = Hu2(), s === e && (s = Fr2(), s === e && (s = hr2())), s === e && (s = null), $2 = u, u = bt2(r, s)) : (n = u, u = e), u;
  }
  function Ku2() {
    var u, r, s;
    return u = n, r = T2(), r !== e ? (s = Hu2(), s === e && (s = null), $2 = u, u = xt2(r, s)) : (n = u, u = e), u;
  }
  function Br2() {
    var u, r, s, o;
    return u = n, E3(), r = Y3(), r !== e ? (E3(), s = Ju2(), s !== e ? (E3(), o = Y3(), o !== e ? ($2 = u, u = It2(s)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function Cr2() {
    var u;
    return u = yr2(), u === e && (u = vr2(), u === e && (u = _r2(), u === e && (u = dr2(), u === e && (u = Er2(), u === e && (u = Dr2(), u === e && (u = mr2(), u === e && (u = $r2()))))))), u;
  }
  function Dr2() {
    var u, r, s;
    return u = n, t.substr(n, 6) === vu2 ? (r = vu2, n += 6) : (r = e, h === 0 && d2(Ge)), r !== e ? (E3(), s = J3(), s !== e ? ($2 = u, u = kt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function dr2() {
    var u, r, s, o, B3;
    return u = n, t.substr(n, 6) === $u2 ? (r = $u2, n += 6) : (r = e, h === 0 && d2(Ye2)), r !== e ? (E3(), s = Y3(), s !== e ? (o = Gu2(), o !== e ? (B3 = Y3(), B3 !== e ? ($2 = u, u = Nt2(o)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function Er2() {
    var u, r, s, o;
    return u = n, t.substr(n, 6) === mu2 ? (r = mu2, n += 6) : (r = e, h === 0 && d2(He)), r !== e ? (E3(), s = ou2(), s !== e ? (E3(), o = ou2(), o !== e ? (E3(), ou2(), $2 = u, u = Pt2(s, o)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function vr2() {
    var u, r, s;
    return u = n, t.substr(n, 4) === _u2 ? (r = _u2, n += 4) : (r = e, h === 0 && d2(Je)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = qt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function $r2() {
    var u, r, s;
    return u = n, t.substr(n, 4) === yu2 ? (r = yu2, n += 4) : (r = e, h === 0 && d2(Ke2)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = jt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function mr2() {
    var u, r, s;
    return u = n, t.substr(n, 4) === wu2 ? (r = wu2, n += 4) : (r = e, h === 0 && d2(Qe2)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = St(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function _r2() {
    var u, r, s;
    return u = n, t.substr(n, 4) === bu2 ? (r = bu2, n += 4) : (r = e, h === 0 && d2(ut2)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = Rt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function yr2() {
    var u, r, s, o, B3;
    if (u = n, t.substr(n, 5) === xu2 ? (r = xu2, n += 5) : (r = e, h === 0 && d2(et2)), r !== e)
      if (E3(), s = Y3(), s !== e) {
        if (o = [], B3 = au2(), B3 !== e)
          for (; B3 !== e; )
            o.push(B3), B3 = au2();
        else
          o = e;
        o !== e ? (B3 = Y3(), B3 !== e ? ($2 = u, u = Lt2(o)) : (n = u, u = e)) : (n = u, u = e);
      } else
        n = u, u = e;
    else
      n = u, u = e;
    return u;
  }
  function Fu2() {
    var u, r, s, o;
    if (u = n, t.substr(n, 2) === Iu2 ? (r = Iu2, n += 2) : (r = e, h === 0 && d2(tt)), r !== e) {
      for (s = [], o = t.charAt(n), Su2.test(o) ? n++ : (o = e, h === 0 && d2(zu2)); o !== e; )
        s.push(o), o = t.charAt(n), Su2.test(o) ? n++ : (o = e, h === 0 && d2(zu2));
      r = [r, s], u = r;
    } else
      n = u, u = e;
    return u;
  }
  function wr2() {
    var u, r, s, o, B3, x, j3, K2;
    if (u = n, t.substr(n, 3) === ku2 ? (r = ku2, n += 3) : (r = e, h === 0 && d2(rt2)), r !== e)
      if (E3(), t.charCodeAt(n) === 91 ? (s = p, n++) : (s = e, h === 0 && d2(Ou2)), s !== e)
        if (E3(), o = J3(), o !== e) {
          for (B3 = [], x = n, j3 = G3(), j3 !== e ? (K2 = J3(), K2 !== e ? ($2 = x, x = Tu2(o, K2)) : (n = x, x = e)) : (n = x, x = e); x !== e; )
            B3.push(x), x = n, j3 = G3(), j3 !== e ? (K2 = J3(), K2 !== e ? ($2 = x, x = Tu2(o, K2)) : (n = x, x = e)) : (n = x, x = e);
          x = E3(), t.charCodeAt(n) === 93 ? (j3 = w2, n++) : (j3 = e, h === 0 && d2(Mu2)), j3 !== e ? ($2 = u, u = Ot2(o, B3)) : (n = u, u = e);
        } else
          n = u, u = e;
      else
        n = u, u = e;
    else
      n = u, u = e;
    return u;
  }
  function br2() {
    var u;
    return u = wr2(), u === e && (u = Br2()), u;
  }
  function J3() {
    var u, r, s, o, B3;
    if (u = n, r = br2(), r !== e) {
      for (E3(), s = [], o = Fu2(); o !== e; )
        s.push(o), o = Fu2();
      $2 = u, u = Mt2(r);
    } else
      n = u, u = e;
    return u === e && (u = n, r = Cr2(), r !== e ? (E3(), t.charCodeAt(n) === 36 ? (s = Ae2, n++) : (s = e, h === 0 && d2(nt)), s !== e ? (o = E3(), B3 = J3(), B3 !== e ? ($2 = u, u = zt2(r, B3)) : (n = u, u = e)) : (n = u, u = e)) : (n = u, u = e)), u;
  }
  function xr2() {
    var u, r;
    return u = n, r = J3(), r !== e && ($2 = u, r = Tt(r)), u = r, u === e && (u = Fu2()), u;
  }
  function Ir2() {
    var u;
    return u = xr2(), u;
  }
  function kr2() {
    var u, r;
    return u = n, E3(), r = Nr2(), r === e && (r = Pr2(), r === e && (r = qr2())), r !== e ? (E3(), $2 = u, u = Zt2(r)) : (n = u, u = e), u;
  }
  function Nr2() {
    var u, r, s;
    return u = n, t.substr(n, 6) === Nu2 ? (r = Nu2, n += 6) : (r = e, h === 0 && d2(st)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = Wt2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function Pr2() {
    var u, r, s;
    return u = n, t.substr(n, 6) === Pu2 ? (r = Pu2, n += 6) : (r = e, h === 0 && d2(it2)), r !== e ? (E3(), s = M(), s !== e ? ($2 = u, u = Ut2(s)) : (n = u, u = e)) : (n = u, u = e), u;
  }
  function qr2() {
    var u, r;
    return u = n, t.substr(n, 4) === qu2 ? (r = qu2, n += 4) : (r = e, h === 0 && d2(ft)), r !== e && ($2 = u, r = Vt()), u = r, u;
  }
  function jr2() {
    var u;
    return u = Ir2(), u === e && (u = kr2()), u;
  }
  var Sr2 = function(u) {
    this.type_ = "atom", this.source_ = u, this.location_ = Zu2();
  }, lu2 = function(u, r, s, o) {
    this.type_ = "pattern", this.arguments_ = { alignment: r, _steps: o }, s !== void 0 && (this.arguments_.seed = s), this.source_ = u;
  }, Rr2 = function(u, r, s) {
    this.type_ = u, this.arguments_ = r, this.source_ = s;
  }, Lr2 = function(u, r) {
    this.type_ = "element", this.source_ = u, this.options_ = r, this.location_ = Zu2();
  }, hu2 = function(u, r) {
    this.type_ = "command", this.name_ = u, this.options_ = r;
  }, Bu2 = 0;
  if (eu2 = a(), i2.peg$library)
    return (
      /** @type {any} */
      {
        peg$result: eu2,
        peg$currPos: n,
        peg$FAILED: e,
        peg$maxFailExpected: fu2,
        peg$maxFailPos: q3
      }
    );
  if (eu2 !== e && n === t.length)
    return eu2;
  throw eu2 !== e && n < t.length && d2(Gt()), Yt2(
    fu2,
    q3 < t.length ? t.charAt(q3) : null,
    q3 < t.length ? gu2(q3, q3 + 1) : gu2(q3, q3)
  );
}
var Gr2 = [
  "start"
];
typeof BigInt > "u" && (BigInt = function(t) {
  if (isNaN(t)) throw new Error("");
  return t;
});
var C2 = BigInt(0);
var m2 = BigInt(1);
var ru2 = BigInt(2);
var Du2 = BigInt(5);
var N2 = BigInt(10);
var zr2 = 2e3;
var A = {
  s: m2,
  n: C2,
  d: m2
};
function z2(t, i2) {
  try {
    t = BigInt(t);
  } catch {
    throw Z2();
  }
  return t * i2;
}
function S2(t) {
  return typeof t == "bigint" ? t : Math.floor(t);
}
function I(t, i2) {
  if (i2 === C2)
    throw du2();
  const e = Object.create(b.prototype);
  e.s = t < C2 ? -m2 : m2, t = t < C2 ? -t : t;
  const f2 = U2(t, i2);
  return e.n = t / f2, e.d = i2 / f2, e;
}
function Q2(t) {
  const i2 = {};
  let e = t, f2 = ru2, l2 = Du2 - m2;
  for (; l2 <= e; ) {
    for (; e % f2 === C2; )
      e /= f2, i2[f2] = (i2[f2] || C2) + m2;
    l2 += m2 + ru2 * f2++;
  }
  return e !== t ? e > 1 && (i2[e] = (i2[e] || C2) + m2) : i2[t] = (i2[t] || C2) + m2, i2;
}
var k = function(t, i2) {
  let e = C2, f2 = m2, l2 = m2;
  if (t != null) if (i2 !== void 0) {
    if (typeof t == "bigint")
      e = t;
    else {
      if (isNaN(t))
        throw Z2();
      if (t % 1 !== 0)
        throw Qu2();
      e = BigInt(t);
    }
    if (typeof i2 == "bigint")
      f2 = i2;
    else {
      if (isNaN(i2))
        throw Z2();
      if (i2 % 1 !== 0)
        throw Qu2();
      f2 = BigInt(i2);
    }
    l2 = e * f2;
  } else if (typeof t == "object") {
    if ("d" in t && "n" in t)
      e = BigInt(t.n), f2 = BigInt(t.d), "s" in t && (e *= BigInt(t.s));
    else if (0 in t)
      e = BigInt(t[0]), 1 in t && (f2 = BigInt(t[1]));
    else if (typeof t == "bigint")
      e = t;
    else
      throw Z2();
    l2 = e * f2;
  } else if (typeof t == "number") {
    if (isNaN(t))
      throw Z2();
    if (t < 0 && (l2 = -m2, t = -t), t % 1 === 0)
      e = BigInt(t);
    else if (t > 0) {
      let a = 1, D2 = 0, v = 1, g = 1, c2 = 1, F3 = 1e7;
      for (t >= 1 && (a = 10 ** Math.floor(1 + Math.log10(t)), t /= a); v <= F3 && c2 <= F3; ) {
        let p = (D2 + g) / (v + c2);
        if (t === p) {
          v + c2 <= F3 ? (e = D2 + g, f2 = v + c2) : c2 > v ? (e = g, f2 = c2) : (e = D2, f2 = v);
          break;
        } else
          t > p ? (D2 += g, v += c2) : (g += D2, c2 += v), v > F3 ? (e = g, f2 = c2) : (e = D2, f2 = v);
      }
      e = BigInt(e) * BigInt(a), f2 = BigInt(f2);
    }
  } else if (typeof t == "string") {
    let a = 0, D2 = C2, v = C2, g = C2, c2 = m2, F3 = m2, p = t.replace(/_/g, "").match(/\d+|./g);
    if (p === null)
      throw Z2();
    if (p[a] === "-" ? (l2 = -m2, a++) : p[a] === "+" && a++, p.length === a + 1 ? v = z2(p[a++], l2) : p[a + 1] === "." || p[a] === "." ? (p[a] !== "." && (D2 = z2(p[a++], l2)), a++, (a + 1 === p.length || p[a + 1] === "(" && p[a + 3] === ")" || p[a + 1] === "'" && p[a + 3] === "'") && (v = z2(p[a], l2), c2 = N2 ** BigInt(p[a].length), a++), (p[a] === "(" && p[a + 2] === ")" || p[a] === "'" && p[a + 2] === "'") && (g = z2(p[a + 1], l2), F3 = N2 ** BigInt(p[a + 1].length) - m2, a += 3)) : p[a + 1] === "/" || p[a + 1] === ":" ? (v = z2(p[a], l2), c2 = z2(p[a + 2], m2), a += 3) : p[a + 3] === "/" && p[a + 1] === " " && (D2 = z2(p[a], l2), v = z2(p[a + 2], l2), c2 = z2(p[a + 4], m2), a += 5), p.length <= a)
      f2 = c2 * F3, l2 = /* void */
      e = g + f2 * D2 + F3 * v;
    else
      throw Z2();
  } else if (typeof t == "bigint")
    e = t, l2 = t, f2 = m2;
  else
    throw Z2();
  if (f2 === C2)
    throw du2();
  A.s = l2 < C2 ? -m2 : m2, A.n = e < C2 ? -e : e, A.d = f2 < C2 ? -f2 : f2;
};
function Tr2(t, i2, e) {
  let f2 = m2;
  for (; i2 > C2; t = t * t % e, i2 >>= m2)
    i2 & m2 && (f2 = f2 * t % e);
  return f2;
}
function Zr2(t, i2) {
  for (; i2 % ru2 === C2; i2 /= ru2)
    ;
  for (; i2 % Du2 === C2; i2 /= Du2)
    ;
  if (i2 === m2)
    return C2;
  let e = N2 % i2, f2 = 1;
  for (; e !== m2; f2++)
    if (e = e * N2 % i2, f2 > zr2)
      return C2;
  return BigInt(f2);
}
function Wr2(t, i2, e) {
  let f2 = m2, l2 = Tr2(N2, e, i2);
  for (let a = 0; a < 300; a++) {
    if (f2 === l2)
      return BigInt(a);
    f2 = f2 * N2 % i2, l2 = l2 * N2 % i2;
  }
  return 0;
}
function U2(t, i2) {
  if (!t)
    return i2;
  if (!i2)
    return t;
  for (; ; ) {
    if (t %= i2, !t)
      return i2;
    if (i2 %= t, !i2)
      return t;
  }
}
function b(t, i2) {
  if (k(t, i2), this instanceof b)
    t = U2(A.d, A.n), this.s = A.s, this.n = A.n / t, this.d = A.d / t;
  else
    return I(A.s * A.n, A.d);
}
var du2 = function() {
  return new Error("Division by Zero");
};
var Z2 = function() {
  return new Error("Invalid argument");
};
var Qu2 = function() {
  return new Error("Parameters must be integer");
};
b.prototype = {
  s: m2,
  n: C2,
  d: m2,
  /**
   * Calculates the absolute value
   *
   * Ex: new Fraction(-4).abs() => 4
   **/
  abs: function() {
    return I(this.n, this.d);
  },
  /**
   * Inverts the sign of the current fraction
   *
   * Ex: new Fraction(-4).neg() => 4
   **/
  neg: function() {
    return I(-this.s * this.n, this.d);
  },
  /**
   * Adds two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
   **/
  add: function(t, i2) {
    return k(t, i2), I(
      this.s * this.n * A.d + A.s * this.d * A.n,
      this.d * A.d
    );
  },
  /**
   * Subtracts two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
   **/
  sub: function(t, i2) {
    return k(t, i2), I(
      this.s * this.n * A.d - A.s * this.d * A.n,
      this.d * A.d
    );
  },
  /**
   * Multiplies two rational numbers
   *
   * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
   **/
  mul: function(t, i2) {
    return k(t, i2), I(
      this.s * A.s * this.n * A.n,
      this.d * A.d
    );
  },
  /**
   * Divides two rational numbers
   *
   * Ex: new Fraction("-17.(345)").inverse().div(3)
   **/
  div: function(t, i2) {
    return k(t, i2), I(
      this.s * A.s * this.n * A.d,
      this.d * A.n
    );
  },
  /**
   * Clones the actual object
   *
   * Ex: new Fraction("-17.(345)").clone()
   **/
  clone: function() {
    return I(this.s * this.n, this.d);
  },
  /**
   * Calculates the modulo of two rational numbers - a more precise fmod
   *
   * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
   * Ex: new Fraction(20, 10).mod().equals(0) ? "is Integer"
   **/
  mod: function(t, i2) {
    if (t === void 0)
      return I(this.s * this.n % this.d, m2);
    if (k(t, i2), C2 === A.n * this.d)
      throw du2();
    return I(
      this.s * (A.d * this.n) % (A.n * this.d),
      A.d * this.d
    );
  },
  /**
   * Calculates the fractional gcd of two rational numbers
   *
   * Ex: new Fraction(5,8).gcd(3,7) => 1/56
   */
  gcd: function(t, i2) {
    return k(t, i2), I(U2(A.n, this.n) * U2(A.d, this.d), A.d * this.d);
  },
  /**
   * Calculates the fractional lcm of two rational numbers
   *
   * Ex: new Fraction(5,8).lcm(3,7) => 15
   */
  lcm: function(t, i2) {
    return k(t, i2), A.n === C2 && this.n === C2 ? I(C2, m2) : I(A.n * this.n, U2(A.n, this.n) * U2(A.d, this.d));
  },
  /**
   * Gets the inverse of the fraction, means numerator and denominator are exchanged
   *
   * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
   **/
  inverse: function() {
    return I(this.s * this.d, this.n);
  },
  /**
   * Calculates the fraction to some integer exponent
   *
   * Ex: new Fraction(-1,2).pow(-3) => -8
   */
  pow: function(t, i2) {
    if (k(t, i2), A.d === m2)
      return A.s < C2 ? I((this.s * this.d) ** A.n, this.n ** A.n) : I((this.s * this.n) ** A.n, this.d ** A.n);
    if (this.s < C2) return null;
    let e = Q2(this.n), f2 = Q2(this.d), l2 = m2, a = m2;
    for (let D2 in e)
      if (D2 !== "1") {
        if (D2 === "0") {
          l2 = C2;
          break;
        }
        if (e[D2] *= A.n, e[D2] % A.d === C2)
          e[D2] /= A.d;
        else return null;
        l2 *= BigInt(D2) ** e[D2];
      }
    for (let D2 in f2)
      if (D2 !== "1") {
        if (f2[D2] *= A.n, f2[D2] % A.d === C2)
          f2[D2] /= A.d;
        else return null;
        a *= BigInt(D2) ** f2[D2];
      }
    return A.s < C2 ? I(a, l2) : I(l2, a);
  },
  /**
   * Calculates the logarithm of a fraction to a given rational base
   *
   * Ex: new Fraction(27, 8).log(9, 4) => 3/2
   */
  log: function(t, i2) {
    if (k(t, i2), this.s <= C2 || A.s <= C2) return null;
    const e = {}, f2 = Q2(A.n), l2 = Q2(A.d), a = Q2(this.n), D2 = Q2(this.d);
    for (const c2 in l2)
      f2[c2] = (f2[c2] || C2) - l2[c2];
    for (const c2 in D2)
      a[c2] = (a[c2] || C2) - D2[c2];
    for (const c2 in f2)
      c2 !== "1" && (e[c2] = true);
    for (const c2 in a)
      c2 !== "1" && (e[c2] = true);
    let v = null, g = null;
    for (const c2 in e) {
      const F3 = f2[c2] || C2, p = a[c2] || C2;
      if (F3 === C2) {
        if (p !== C2)
          return null;
        continue;
      }
      let w2 = p, P3 = F3;
      const R3 = U2(w2, P3);
      if (w2 /= R3, P3 /= R3, v === null && g === null)
        v = w2, g = P3;
      else if (w2 * g !== v * P3)
        return null;
    }
    return v !== null && g !== null ? I(v, g) : null;
  },
  /**
   * Check if two rational numbers are the same
   *
   * Ex: new Fraction(19.6).equals([98, 5]);
   **/
  equals: function(t, i2) {
    return k(t, i2), this.s * this.n * A.d === A.s * A.n * this.d;
  },
  /**
   * Check if this rational number is less than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  lt: function(t, i2) {
    return k(t, i2), this.s * this.n * A.d < A.s * A.n * this.d;
  },
  /**
   * Check if this rational number is less than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  lte: function(t, i2) {
    return k(t, i2), this.s * this.n * A.d <= A.s * A.n * this.d;
  },
  /**
   * Check if this rational number is greater than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  gt: function(t, i2) {
    return k(t, i2), this.s * this.n * A.d > A.s * A.n * this.d;
  },
  /**
   * Check if this rational number is greater than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  gte: function(t, i2) {
    return k(t, i2), this.s * this.n * A.d >= A.s * A.n * this.d;
  },
  /**
   * Compare two rational numbers
   * < 0 iff this < that
   * > 0 iff this > that
   * = 0 iff this = that
   *
   * Ex: new Fraction(19.6).compare([98, 5]);
   **/
  compare: function(t, i2) {
    k(t, i2);
    let e = this.s * this.n * A.d - A.s * A.n * this.d;
    return (C2 < e) - (e < C2);
  },
  /**
   * Calculates the ceil of a rational number
   *
   * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
   **/
  ceil: function(t) {
    return t = N2 ** BigInt(t || 0), I(
      S2(this.s * t * this.n / this.d) + (t * this.n % this.d > C2 && this.s >= C2 ? m2 : C2),
      t
    );
  },
  /**
   * Calculates the floor of a rational number
   *
   * Ex: new Fraction('4.(3)').floor() => (4 / 1)
   **/
  floor: function(t) {
    return t = N2 ** BigInt(t || 0), I(
      S2(this.s * t * this.n / this.d) - (t * this.n % this.d > C2 && this.s < C2 ? m2 : C2),
      t
    );
  },
  /**
   * Rounds a rational numbers
   *
   * Ex: new Fraction('4.(3)').round() => (4 / 1)
   **/
  round: function(t) {
    return t = N2 ** BigInt(t || 0), I(
      S2(this.s * t * this.n / this.d) + this.s * ((this.s >= C2 ? m2 : C2) + ru2 * (t * this.n % this.d) > this.d ? m2 : C2),
      t
    );
  },
  /**
    * Rounds a rational number to a multiple of another rational number
    *
    * Ex: new Fraction('0.9').roundTo("1/8") => 7 / 8
    **/
  roundTo: function(t, i2) {
    k(t, i2);
    const e = this.n * A.d, f2 = this.d * A.n, l2 = e % f2;
    let a = S2(e / f2);
    return l2 + l2 >= f2 && a++, I(this.s * a * A.n, A.d);
  },
  /**
   * Check if two rational numbers are divisible
   *
   * Ex: new Fraction(19.6).divisible(1.5);
   */
  divisible: function(t, i2) {
    return k(t, i2), !(!(A.n * this.d) || this.n * A.d % (A.n * this.d));
  },
  /**
   * Returns a decimal representation of the fraction
   *
   * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
   **/
  valueOf: function() {
    return Number(this.s * this.n) / Number(this.d);
  },
  /**
   * Creates a string representation of a fraction with all digits
   *
   * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
   **/
  toString: function(t) {
    let i2 = this.n, e = this.d;
    t = t || 15;
    let f2 = Zr2(i2, e), l2 = Wr2(i2, e, f2), a = this.s < C2 ? "-" : "";
    if (a += S2(i2 / e), i2 %= e, i2 *= N2, i2 && (a += "."), f2) {
      for (let D2 = l2; D2--; )
        a += S2(i2 / e), i2 %= e, i2 *= N2;
      a += "(";
      for (let D2 = f2; D2--; )
        a += S2(i2 / e), i2 %= e, i2 *= N2;
      a += ")";
    } else
      for (let D2 = t; i2 && D2--; )
        a += S2(i2 / e), i2 %= e, i2 *= N2;
    return a;
  },
  /**
   * Returns a string-fraction representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
   **/
  toFraction: function(t) {
    let i2 = this.n, e = this.d, f2 = this.s < C2 ? "-" : "";
    if (e === m2)
      f2 += i2;
    else {
      let l2 = S2(i2 / e);
      t && l2 > C2 && (f2 += l2, f2 += " ", i2 %= e), f2 += i2, f2 += "/", f2 += e;
    }
    return f2;
  },
  /**
   * Returns a latex representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
   **/
  toLatex: function(t) {
    let i2 = this.n, e = this.d, f2 = this.s < C2 ? "-" : "";
    if (e === m2)
      f2 += i2;
    else {
      let l2 = S2(i2 / e);
      t && l2 > C2 && (f2 += l2, i2 %= e), f2 += "\\frac{", f2 += i2, f2 += "}{", f2 += e, f2 += "}";
    }
    return f2;
  },
  /**
   * Returns an array of continued fraction elements
   *
   * Ex: new Fraction("7/8").toContinued() => [0,1,7]
   */
  toContinued: function() {
    let t = this.n, i2 = this.d, e = [];
    do {
      e.push(S2(t / i2));
      let f2 = t % i2;
      t = i2, i2 = f2;
    } while (t !== m2);
    return e;
  },
  simplify: function(t) {
    const i2 = BigInt(1 / (t || 1e-3) | 0), e = this.abs(), f2 = e.toContinued();
    for (let l2 = 1; l2 < f2.length; l2++) {
      let a = I(f2[l2 - 1], m2);
      for (let v = l2 - 2; v >= 0; v--)
        a = a.inverse().add(f2[v]);
      let D2 = a.sub(e);
      if (D2.n * i2 < D2.d)
        return a.mul(this.s);
    }
    return this;
  }
};
var L2 = class _L {
  constructor(i2, e) {
    this.begin = W2(i2), this.end = W2(e);
  }
  get spanCycles() {
    const i2 = [];
    var e = this.begin;
    const f2 = this.end, l2 = f2.sam();
    if (e.equals(f2))
      return [new _L(e, f2)];
    for (; f2.gt(e); ) {
      if (e.sam().equals(l2)) {
        i2.push(new _L(e, this.end));
        break;
      }
      const a = e.nextSam();
      i2.push(new _L(e, a)), e = a;
    }
    return i2;
  }
  get duration() {
    return this.end.sub(this.begin);
  }
  cycleArc() {
    const i2 = this.begin.cyclePos(), e = i2.add(this.duration);
    return new _L(i2, e);
  }
  withTime(i2) {
    return new _L(i2(this.begin), i2(this.end));
  }
  withEnd(i2) {
    return new _L(this.begin, i2(this.end));
  }
  withCycle(i2) {
    const e = this.begin.sam(), f2 = e.add(i2(this.begin.sub(e))), l2 = e.add(i2(this.end.sub(e)));
    return new _L(f2, l2);
  }
  intersection(i2) {
    const e = this.begin.max(i2.begin), f2 = this.end.min(i2.end);
    if (!e.gt(f2) && !(e.equals(f2) && (e.equals(this.end) && this.begin.lt(this.end) || e.equals(i2.end) && i2.begin.lt(i2.end))))
      return new _L(e, f2);
  }
  intersection_e(i2) {
    const e = this.intersection(i2);
    if (e == null)
      throw "TimeSpans do not intersect";
    return e;
  }
  midpoint() {
    return this.begin.add(this.duration.div(W2(2)));
  }
  equals(i2) {
    return this.begin.equals(i2.begin) && this.end.equals(i2.end);
  }
  show() {
    return this.begin.show() + " \u2192 " + this.end.show();
  }
};
var Ur2 = (t) => t.filter((i2) => i2 != null);
b.prototype.sam = function() {
  return this.floor();
};
b.prototype.nextSam = function() {
  return this.sam().add(1);
};
b.prototype.wholeCycle = function() {
  return new L2(this.sam(), this.nextSam());
};
b.prototype.cyclePos = function() {
  return this.sub(this.sam());
};
b.prototype.lt = function(t) {
  return this.compare(t) < 0;
};
b.prototype.gt = function(t) {
  return this.compare(t) > 0;
};
b.prototype.lte = function(t) {
  return this.compare(t) <= 0;
};
b.prototype.gte = function(t) {
  return this.compare(t) >= 0;
};
b.prototype.eq = function(t) {
  return this.compare(t) == 0;
};
b.prototype.ne = function(t) {
  return this.compare(t) != 0;
};
b.prototype.max = function(t) {
  return this.gt(t) ? this : t;
};
b.prototype.maximum = function(...t) {
  return t = t.map((i2) => new b(i2)), t.reduce((i2, e) => e.max(i2), this);
};
b.prototype.min = function(t) {
  return this.lt(t) ? this : t;
};
b.prototype.mulmaybe = function(t) {
  return t !== void 0 ? this.mul(t) : void 0;
};
b.prototype.divmaybe = function(t) {
  return t !== void 0 ? this.div(t) : void 0;
};
b.prototype.addmaybe = function(t) {
  return t !== void 0 ? this.add(t) : void 0;
};
b.prototype.submaybe = function(t) {
  return t !== void 0 ? this.sub(t) : void 0;
};
b.prototype.show = function() {
  return this.s * this.n + "/" + this.d;
};
b.prototype.or = function(t) {
  return this.eq(0) ? t : this;
};
var W2 = (t) => b(t);
var cu2 = (...t) => {
  if (t = Ur2(t), t.length === 0)
    return;
  const i2 = t.pop();
  return t.reduce(
    (e, f2) => e === void 0 || f2 === void 0 ? void 0 : e.lcm(f2),
    i2
  );
};
W2._original = b;
var ue2 = 3e-4;
var Vr2 = (t, i2) => (e, f2) => {
  const D2 = t.source_[f2].options_?.ops, v = e.__steps_source;
  if (D2)
    for (const g of D2)
      switch (g.type_) {
        case "stretch": {
          const c2 = ["fast", "slow"], { type: F3, amount: p } = g.arguments_;
          if (!c2.includes(F3))
            throw new Error(`mini: stretch: type must be one of ${c2.join("|")} but got ${F3}`);
          e = d(e)[F3](i2(p));
          break;
        }
        case "replicate": {
          const { amount: c2 } = g.arguments_;
          e = d(e), e = e._repeatCycles(c2)._fast(c2);
          break;
        }
        case "bjorklund": {
          g.arguments_.rotation ? e = e.euclidRot(i2(g.arguments_.pulse), i2(g.arguments_.step), i2(g.arguments_.rotation)) : e = e.euclid(i2(g.arguments_.pulse), i2(g.arguments_.step));
          break;
        }
        case "degradeBy": {
          e = d(e)._degradeByWith(W.early(ue2 * g.arguments_.seed), g.arguments_.amount ?? 0.5);
          break;
        }
        case "tail": {
          const c2 = i2(g.arguments_.element);
          e = e.fmap((F3) => (p) => Array.isArray(F3) ? [...F3, p] : [F3, p]).appLeft(c2);
          break;
        }
        case "range": {
          const c2 = i2(g.arguments_.element);
          e = d(e);
          const F3 = (w2, P3, R3 = 1) => Array.from(
            { length: Math.abs(P3 - w2) / R3 + 1 },
            (su2, iu2) => w2 < P3 ? w2 + iu2 * R3 : w2 - iu2 * R3
          );
          e = ((w2, P3) => w2.squeezeBind((R3) => P3.bind((su2) => N(...F3(R3, su2)))))(e, c2);
          break;
        }
        default:
          console.warn(`operator "${g.type_}" not implemented`);
      }
  return e.__steps_source = e.__steps_source || v, e;
};
function nu2(t, i2, e, f2 = 0) {
  e?.(t);
  const l2 = (a) => nu2(a, i2, e, f2);
  switch (t.type_) {
    case "pattern": {
      const a = t.source_.map((c2) => l2(c2)).map(Vr2(t, l2)), D2 = t.arguments_.alignment, v = a.filter((c2) => c2.__steps_source);
      let g;
      switch (D2) {
        case "stack": {
          g = z(...a), v.length && (g._steps = cu2(...v.map((c2) => W2(c2._steps))));
          break;
        }
        case "polymeter_slowcat": {
          g = z(...a.map((c2) => c2._slow(c2.__weight))), v.length && (g._steps = cu2(...v.map((c2) => W2(c2._steps))));
          break;
        }
        case "polymeter": {
          const c2 = t.arguments_.stepsPerCycle ? l2(t.arguments_.stepsPerCycle).fmap((p) => m(p)) : C(m(a.length > 0 ? a[0].__weight : 1)), F3 = a.map((p) => p.fast(c2.fmap((w2) => w2.div(p.__weight))));
          g = z(...F3);
          break;
        }
        case "rand": {
          g = Pe(W.early(ue2 * t.arguments_.seed).segment(1), a), v.length && (g._steps = cu2(...v.map((c2) => W2(c2._steps))));
          break;
        }
        case "feet": {
          g = N(...a);
          break;
        }
        default: {
          if (t.source_.some((F3) => !!F3.options_?.weight)) {
            const F3 = t.source_.reduce(
              (p, w2) => p.add(w2.options_?.weight || m(1)),
              m(0)
            );
            g = ns(
              ...t.source_.map((p, w2) => [p.options_?.weight || m(1), a[w2]])
            ), g.__weight = F3, g._steps = F3, v.length && (g._steps = g._steps.mul(cu2(...v.map((p) => W2(p._steps)))));
          } else
            g = Q(...a), g._steps = a.length;
          t.arguments_._steps && (g.__steps_source = true);
        }
      }
      return v.length && (g.__steps_source = true), g;
    }
    case "element":
      return l2(t.source_);
    case "atom": {
      if (t.source_ === "~" || t.source_ === "-")
        return q;
      if (!t.location_)
        return console.warn("no location for", t), t.source_;
      const a = isNaN(Number(t.source_)) ? t.source_ : Number(t.source_);
      if (f2 === -1)
        return C(a);
      const [D2, v] = ee2(i2, t, f2);
      return C(a).withLoc(D2, v);
    }
    case "stretch":
      return l2(t.source_).slow(l2(t.arguments_.amount));
    default:
      return console.warn(`node type "${t.type_}" not implemented -> returning silence`), q;
  }
}
var ee2 = (t, i2, e = 0) => {
  const { start: f2, end: l2 } = i2.location_, a = t?.split("").slice(f2.offset, l2.offset).join(""), [D2 = 0, v = 0] = a ? a.split(i2.source_).map((g) => g.split("").filter((c2) => c2 === " ").length) : [];
  return [f2.offset + D2 + e, l2.offset - v + e];
};
var Au2 = (t, i2 = 0, e = t) => {
  try {
    return Mr2(t);
  } catch (f2) {
    const l2 = [f2.location.start.offset + i2, f2.location.end.offset + i2], a = e.slice(0, l2[0]).split(`
`).length;
    throw new Error(`[mini] parse error at line ${a}: ${f2.message}`);
  }
};
var Xr2 = (t, i2, e) => {
  const f2 = Au2(t, i2, e);
  let l2 = [];
  return nu2(
    f2,
    t,
    (a) => {
      a.type_ === "atom" && l2.push(a);
    },
    -1
  ), l2;
};
var Yr2 = (t, i2 = 0, e) => Xr2(t, i2, e).map((f2) => ee2(t, f2, i2));
var te2 = (...t) => {
  const i2 = t.map((e) => {
    const f2 = `"${e}"`, l2 = Au2(f2);
    return nu2(l2, f2);
  });
  return Q(...i2);
};
var Hr2 = (t, i2) => {
  const e = `"${t}"`, f2 = Au2(e);
  return nu2(f2, e, null, i2);
};
var Jr2 = (t) => {
  const i2 = Au2(t);
  return nu2(i2, t);
};
function Kr2(t) {
  return typeof t == "string" ? te2(t) : d(t);
}
function Qr2() {
  mh(te2);
}

// node_modules/acorn/dist/acorn.mjs
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 78, 5, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 199, 7, 137, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 55, 9, 266, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 233, 0, 3, 0, 8, 1, 6, 0, 475, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 7, 25, 39, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 5, 57, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 24, 43, 261, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 33, 24, 3, 24, 45, 74, 6, 0, 67, 12, 65, 1, 2, 0, 15, 4, 10, 7381, 42, 31, 98, 114, 8702, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 208, 30, 2, 2, 2, 1, 2, 6, 3, 4, 10, 1, 225, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4381, 3, 5773, 3, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 8489];
var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1ADD\u1AE0-\u1AEB\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\u30FB\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F\uFF65";
var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088F\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5C\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDC-\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7DC\uA7F1-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
};
var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
var keywords$1 = {
  5: ecma5AndLessKeywords,
  "5module": ecma5AndLessKeywords + " export import",
  6: ecma5AndLessKeywords + " const class extends export import super"
};
var keywordRelationalOperator = /^in(stanceof)?$/;
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
function isInAstralSet(code2, set) {
  var pos = 65536;
  for (var i2 = 0; i2 < set.length; i2 += 2) {
    pos += set[i2];
    if (pos > code2) {
      return false;
    }
    pos += set[i2 + 1];
    if (pos >= code2) {
      return true;
    }
  }
  return false;
}
function isIdentifierStart(code2, astral) {
  if (code2 < 65) {
    return code2 === 36;
  }
  if (code2 < 91) {
    return true;
  }
  if (code2 < 97) {
    return code2 === 95;
  }
  if (code2 < 123) {
    return true;
  }
  if (code2 <= 65535) {
    return code2 >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code2));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code2, astralIdentifierStartCodes);
}
function isIdentifierChar(code2, astral) {
  if (code2 < 48) {
    return code2 === 36;
  }
  if (code2 < 58) {
    return true;
  }
  if (code2 < 65) {
    return false;
  }
  if (code2 < 91) {
    return true;
  }
  if (code2 < 97) {
    return code2 === 95;
  }
  if (code2 < 123) {
    return true;
  }
  if (code2 <= 65535) {
    return code2 >= 170 && nonASCIIidentifier.test(String.fromCharCode(code2));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code2, astralIdentifierStartCodes) || isInAstralSet(code2, astralIdentifierCodes);
}
var TokenType = function TokenType2(label, conf) {
  if (conf === void 0) conf = {};
  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};
function binop(name, prec) {
  return new TokenType(name, { beforeExpr: true, binop: prec });
}
var beforeExpr = { beforeExpr: true };
var startsExpr = { startsExpr: true };
var keywords = {};
function kw2(name, options) {
  if (options === void 0) options = {};
  options.keyword = name;
  return keywords[name] = new TokenType(name, options);
}
var types$1 = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  privateId: new TokenType("privateId", startsExpr),
  eof: new TokenType("eof"),
  // Punctuation token types.
  bracketL: new TokenType("[", { beforeExpr: true, startsExpr: true }),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", { beforeExpr: true, startsExpr: true }),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", { beforeExpr: true, startsExpr: true }),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  invalidTemplate: new TokenType("invalidTemplate"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", { beforeExpr: true, startsExpr: true }),
  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.
  eq: new TokenType("=", { beforeExpr: true, isAssign: true }),
  assign: new TokenType("_=", { beforeExpr: true, isAssign: true }),
  incDec: new TokenType("++/--", { prefix: true, postfix: true, startsExpr: true }),
  prefix: new TokenType("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=/===/!==", 6),
  relational: binop("</>/<=/>=", 7),
  bitShift: binop("<</>>/>>>", 8),
  plusMin: new TokenType("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType("**", { beforeExpr: true }),
  coalesce: binop("??", 1),
  // Keyword token types.
  _break: kw2("break"),
  _case: kw2("case", beforeExpr),
  _catch: kw2("catch"),
  _continue: kw2("continue"),
  _debugger: kw2("debugger"),
  _default: kw2("default", beforeExpr),
  _do: kw2("do", { isLoop: true, beforeExpr: true }),
  _else: kw2("else", beforeExpr),
  _finally: kw2("finally"),
  _for: kw2("for", { isLoop: true }),
  _function: kw2("function", startsExpr),
  _if: kw2("if"),
  _return: kw2("return", beforeExpr),
  _switch: kw2("switch"),
  _throw: kw2("throw", beforeExpr),
  _try: kw2("try"),
  _var: kw2("var"),
  _const: kw2("const"),
  _while: kw2("while", { isLoop: true }),
  _with: kw2("with"),
  _new: kw2("new", { beforeExpr: true, startsExpr: true }),
  _this: kw2("this", startsExpr),
  _super: kw2("super", startsExpr),
  _class: kw2("class", startsExpr),
  _extends: kw2("extends", beforeExpr),
  _export: kw2("export"),
  _import: kw2("import", startsExpr),
  _null: kw2("null", startsExpr),
  _true: kw2("true", startsExpr),
  _false: kw2("false", startsExpr),
  _in: kw2("in", { beforeExpr: true, binop: 7 }),
  _instanceof: kw2("instanceof", { beforeExpr: true, binop: 7 }),
  _typeof: kw2("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
  _void: kw2("void", { beforeExpr: true, prefix: true, startsExpr: true }),
  _delete: kw2("delete", { beforeExpr: true, prefix: true, startsExpr: true })
};
var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, "g");
function isNewLine(code2) {
  return code2 === 10 || code2 === 13 || code2 === 8232 || code2 === 8233;
}
function nextLineBreak(code2, from, end) {
  if (end === void 0) end = code2.length;
  for (var i2 = from; i2 < end; i2++) {
    var next = code2.charCodeAt(i2);
    if (isNewLine(next)) {
      return i2 < end - 1 && next === 13 && code2.charCodeAt(i2 + 1) === 10 ? i2 + 2 : i2 + 1;
    }
  }
  return -1;
}
var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
var ref = Object.prototype;
var hasOwnProperty = ref.hasOwnProperty;
var toString = ref.toString;
var hasOwn = Object.hasOwn || (function(obj, propName) {
  return hasOwnProperty.call(obj, propName);
});
var isArray = Array.isArray || (function(obj) {
  return toString.call(obj) === "[object Array]";
});
var regexpCache = /* @__PURE__ */ Object.create(null);
function wordsRegexp(words) {
  return regexpCache[words] || (regexpCache[words] = new RegExp("^(?:" + words.replace(/ /g, "|") + ")$"));
}
function codePointToString(code2) {
  if (code2 <= 65535) {
    return String.fromCharCode(code2);
  }
  code2 -= 65536;
  return String.fromCharCode((code2 >> 10) + 55296, (code2 & 1023) + 56320);
}
var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;
var Position = function Position2(line, col) {
  this.line = line;
  this.column = col;
};
Position.prototype.offset = function offset(n) {
  return new Position(this.line, this.column + n);
};
var SourceLocation = function SourceLocation2(p, start, end) {
  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) {
    this.source = p.sourceFile;
  }
};
function getLineInfo(input, offset2) {
  for (var line = 1, cur = 0; ; ) {
    var nextBreak = nextLineBreak(input, cur, offset2);
    if (nextBreak < 0) {
      return new Position(line, offset2 - cur);
    }
    ++line;
    cur = nextBreak;
  }
}
var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
  // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10
  // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `"latest"`
  // (the latest version the library supports). This influences
  // support for strict mode, the set of reserved words, and support
  // for new syntax features.
  ecmaVersion: null,
  // `sourceType` indicates the mode the code should be parsed in.
  // Can be either `"script"`, `"module"` or `"commonjs"`. This influences global
  // strict mode and parsing of `import` and `export` declarations.
  sourceType: "script",
  // When set to true, enable strict parsing mode even if `sourceType`
  // is `"script"`.
  strict: false,
  // `onInsertedSemicolon` can be a callback that will be called when
  // a semicolon is automatically inserted. It will be passed the
  // position of the inserted semicolon as an offset, and if
  // `locations` is enabled, it is given the location as a `{line,
  // column}` object as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are only enforced if ecmaVersion >= 5.
  // Set `allowReserved` to a boolean value to explicitly turn this on
  // an off. When this option has the value "never", reserved words
  // and keywords can also not be used as property names.
  allowReserved: null,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program, and an import.meta expression
  // in a script isn't considered an error.
  allowImportExportEverywhere: false,
  // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.
  // When enabled, await identifiers are allowed to appear at the top-level scope,
  // but they are still not allowed in non-async functions.
  allowAwaitOutsideFunction: null,
  // When enabled, super identifiers are not constrained to
  // appearing in methods and do not raise an error when they appear elsewhere.
  allowSuperOutsideMethod: null,
  // When enabled, hashbang directive in the beginning of file is
  // allowed and treated as a line comment. Enabled by default when
  // `ecmaVersion` >= 2023.
  allowHashBang: false,
  // By default, the parser will verify that private properties are
  // only used in places where they are valid and have been declared.
  // Set this to false to turn such checks off.
  checkPrivateFields: true,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokens returned from `tokenizer().getToken()`. Note
  // that you are not allowed to call the parser from the
  // callback—that will corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  // When this option has an array as value, objects representing the
  // comments are pushed to it.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false
};
var warnedAboutEcmaVersion = false;
function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt];
  }
  if (options.ecmaVersion === "latest") {
    options.ecmaVersion = 1e8;
  } else if (options.ecmaVersion == null) {
    if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
      warnedAboutEcmaVersion = true;
      console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
    }
    options.ecmaVersion = 11;
  } else if (options.ecmaVersion >= 2015) {
    options.ecmaVersion -= 2009;
  }
  if (options.allowReserved == null) {
    options.allowReserved = options.ecmaVersion < 5;
  }
  if (!opts || opts.allowHashBang == null) {
    options.allowHashBang = options.ecmaVersion >= 14;
  }
  if (isArray(options.onToken)) {
    var tokens = options.onToken;
    options.onToken = function(token) {
      return tokens.push(token);
    };
  }
  if (isArray(options.onComment)) {
    options.onComment = pushComment(options, options.onComment);
  }
  if (options.sourceType === "commonjs" && options.allowAwaitOutsideFunction) {
    throw new Error("Cannot use allowAwaitOutsideFunction with sourceType: commonjs");
  }
  return options;
}
function pushComment(options, array) {
  return function(block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text,
      start,
      end
    };
    if (options.locations) {
      comment.loc = new SourceLocation(this, startLoc, endLoc);
    }
    if (options.ranges) {
      comment.range = [start, end];
    }
    array.push(comment);
  };
}
var SCOPE_TOP = 1;
var SCOPE_FUNCTION = 2;
var SCOPE_ASYNC = 4;
var SCOPE_GENERATOR = 8;
var SCOPE_ARROW = 16;
var SCOPE_SIMPLE_CATCH = 32;
var SCOPE_SUPER = 64;
var SCOPE_DIRECT_SUPER = 128;
var SCOPE_CLASS_STATIC_BLOCK = 256;
var SCOPE_CLASS_FIELD_INIT = 512;
var SCOPE_SWITCH = 1024;
var SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;
function functionFlags(async, generator) {
  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0);
}
var BIND_NONE = 0;
var BIND_VAR = 1;
var BIND_LEXICAL = 2;
var BIND_FUNCTION = 3;
var BIND_SIMPLE_CATCH = 4;
var BIND_OUTSIDE = 5;
var Parser = function Parser2(options, input, startPos) {
  this.options = options = getOptions(options);
  this.sourceFile = options.sourceFile;
  this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
  var reserved = "";
  if (options.allowReserved !== true) {
    reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
    if (options.sourceType === "module") {
      reserved += " await";
    }
  }
  this.reservedWords = wordsRegexp(reserved);
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
  this.reservedWordsStrict = wordsRegexp(reservedStrict);
  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
  this.input = String(input);
  this.containsEsc = false;
  if (startPos) {
    this.pos = startPos;
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
  } else {
    this.pos = this.lineStart = 0;
    this.curLine = 1;
  }
  this.type = types$1.eof;
  this.value = null;
  this.start = this.end = this.pos;
  this.startLoc = this.endLoc = this.curPosition();
  this.lastTokEndLoc = this.lastTokStartLoc = null;
  this.lastTokStart = this.lastTokEnd = this.pos;
  this.context = this.initialContext();
  this.exprAllowed = true;
  this.inModule = options.sourceType === "module";
  this.strict = this.inModule || options.strict === true || this.strictDirective(this.pos);
  this.potentialArrowAt = -1;
  this.potentialArrowInForAwait = false;
  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
  this.labels = [];
  this.undefinedExports = /* @__PURE__ */ Object.create(null);
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
    this.skipLineComment(2);
  }
  this.scopeStack = [];
  this.enterScope(
    this.options.sourceType === "commonjs" ? SCOPE_FUNCTION : SCOPE_TOP
  );
  this.regexpState = null;
  this.privateNameStack = [];
};
var prototypeAccessors = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, canAwait: { configurable: true }, allowReturn: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true }, allowNewDotTarget: { configurable: true }, allowUsing: { configurable: true }, inClassStaticBlock: { configurable: true } };
Parser.prototype.parse = function parse2() {
  var this$1$1 = this;
  var node = this.options.program || this.startNode();
  this.nextToken();
  return this.catchStackOverflow(function() {
    return this$1$1.parseTopLevel(node);
  });
};
prototypeAccessors.inFunction.get = function() {
  return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0;
};
prototypeAccessors.inGenerator.get = function() {
  return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0;
};
prototypeAccessors.inAsync.get = function() {
  return (this.currentVarScope().flags & SCOPE_ASYNC) > 0;
};
prototypeAccessors.canAwait.get = function() {
  for (var i2 = this.scopeStack.length - 1; i2 >= 0; i2--) {
    var ref2 = this.scopeStack[i2];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT)) {
      return false;
    }
    if (flags & SCOPE_FUNCTION) {
      return (flags & SCOPE_ASYNC) > 0;
    }
  }
  return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
};
prototypeAccessors.allowReturn.get = function() {
  if (this.inFunction) {
    return true;
  }
  if (this.options.allowReturnOutsideFunction && this.currentVarScope().flags & SCOPE_TOP) {
    return true;
  }
  return false;
};
prototypeAccessors.allowSuper.get = function() {
  var ref2 = this.currentThisScope();
  var flags = ref2.flags;
  return (flags & SCOPE_SUPER) > 0 || this.options.allowSuperOutsideMethod;
};
prototypeAccessors.allowDirectSuper.get = function() {
  return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0;
};
prototypeAccessors.treatFunctionsAsVar.get = function() {
  return this.treatFunctionsAsVarInScope(this.currentScope());
};
prototypeAccessors.allowNewDotTarget.get = function() {
  for (var i2 = this.scopeStack.length - 1; i2 >= 0; i2--) {
    var ref2 = this.scopeStack[i2];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) || flags & SCOPE_FUNCTION && !(flags & SCOPE_ARROW)) {
      return true;
    }
  }
  return false;
};
prototypeAccessors.allowUsing.get = function() {
  var ref2 = this.currentScope();
  var flags = ref2.flags;
  if (flags & SCOPE_SWITCH) {
    return false;
  }
  if (!this.inModule && flags & SCOPE_TOP) {
    return false;
  }
  return true;
};
prototypeAccessors.inClassStaticBlock.get = function() {
  return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0;
};
Parser.extend = function extend() {
  var plugins = [], len = arguments.length;
  while (len--) plugins[len] = arguments[len];
  var cls = this;
  for (var i2 = 0; i2 < plugins.length; i2++) {
    cls = plugins[i2](cls);
  }
  return cls;
};
Parser.parse = function parse3(input, options) {
  return new this(options, input).parse();
};
Parser.parseExpressionAt = function parseExpressionAt(input, pos, options) {
  var parser = new this(options, input, pos);
  parser.nextToken();
  return parser.parseExpression();
};
Parser.tokenizer = function tokenizer(input, options) {
  return new this(options, input);
};
Object.defineProperties(Parser.prototype, prototypeAccessors);
var pp$9 = Parser.prototype;
var literal = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
pp$9.strictDirective = function(start) {
  if (this.options.ecmaVersion < 5) {
    return false;
  }
  for (; ; ) {
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    var match = literal.exec(this.input.slice(start));
    if (!match) {
      return false;
    }
    if ((match[1] || match[2]) === "use strict") {
      skipWhiteSpace.lastIndex = start + match[0].length;
      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
      var next = this.input.charAt(end);
      return next === ";" || next === "}" || lineBreak.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=");
    }
    start += match[0].length;
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    if (this.input[start] === ";") {
      start++;
    }
  }
};
pp$9.eat = function(type) {
  if (this.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};
pp$9.isContextual = function(name) {
  return this.type === types$1.name && this.value === name && !this.containsEsc;
};
pp$9.eatContextual = function(name) {
  if (!this.isContextual(name)) {
    return false;
  }
  this.next();
  return true;
};
pp$9.catchStackOverflow = function(f2) {
  try {
    return f2();
  } catch (e) {
    if (e instanceof Error && (/\bstack\b.*\b(exceeded|overflow)\b/i.test(e.message) || /\btoo much recursion\b/i.test(e.message))) {
      this.raise(this.start, "Not enough stack space to parse input");
    } else {
      throw e;
    }
  }
};
pp$9.expectContextual = function(name) {
  if (!this.eatContextual(name)) {
    this.unexpected();
  }
};
pp$9.canInsertSemicolon = function() {
  return this.type === types$1.eof || this.type === types$1.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$9.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon) {
      this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
    }
    return true;
  }
};
pp$9.semicolon = function() {
  if (!this.eat(types$1.semi) && !this.insertSemicolon()) {
    this.unexpected();
  }
};
pp$9.afterTrailingComma = function(tokType, notNext) {
  if (this.type === tokType) {
    if (this.options.onTrailingComma) {
      this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
    }
    if (!notNext) {
      this.next();
    }
    return true;
  }
};
pp$9.expect = function(type) {
  this.eat(type) || this.unexpected();
};
pp$9.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};
var DestructuringErrors = function DestructuringErrors2() {
  this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
};
pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) {
    return;
  }
  if (refDestructuringErrors.trailingComma > -1) {
    this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
  }
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
  if (parens > -1) {
    this.raiseRecoverable(parens, isAssign ? "Assigning to rvalue" : "Parenthesized pattern");
  }
};
pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) {
    return false;
  }
  var shorthandAssign = refDestructuringErrors.shorthandAssign;
  var doubleProto = refDestructuringErrors.doubleProto;
  if (!andThrow) {
    return shorthandAssign >= 0 || doubleProto >= 0;
  }
  if (shorthandAssign >= 0) {
    this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
  }
  if (doubleProto >= 0) {
    this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
  }
};
pp$9.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
    this.raise(this.yieldPos, "Yield expression cannot be a default value");
  }
  if (this.awaitPos) {
    this.raise(this.awaitPos, "Await expression cannot be a default value");
  }
};
pp$9.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression") {
    return this.isSimpleAssignTarget(expr.expression);
  }
  return expr.type === "Identifier" || expr.type === "MemberExpression";
};
var pp$8 = Parser.prototype;
pp$8.parseTopLevel = function(node) {
  var exports$1 = /* @__PURE__ */ Object.create(null);
  if (!node.body) {
    node.body = [];
  }
  while (this.type !== types$1.eof) {
    var stmt = this.parseStatement(null, true, exports$1);
    node.body.push(stmt);
  }
  if (this.inModule) {
    for (var i2 = 0, list2 = Object.keys(this.undefinedExports); i2 < list2.length; i2 += 1) {
      var name = list2[i2];
      this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
    }
  }
  this.adaptDirectivePrologue(node.body);
  this.next();
  node.sourceType = this.options.sourceType === "commonjs" ? "script" : this.options.sourceType;
  return this.finishNode(node, "Program");
};
var loopLabel = { kind: "loop" };
var switchLabel = { kind: "switch" };
pp$8.isLet = function(context) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, nextCh = this.fullCharCodeAt(next);
  if (nextCh === 91 || nextCh === 92) {
    return true;
  }
  if (context) {
    return false;
  }
  if (nextCh === 123) {
    return true;
  }
  if (isIdentifierStart(nextCh)) {
    var start = next;
    do {
      next += nextCh <= 65535 ? 1 : 2;
    } while (isIdentifierChar(nextCh = this.fullCharCodeAt(next)));
    if (nextCh === 92) {
      return true;
    }
    var ident = this.input.slice(start, next);
    if (!keywordRelationalOperator.test(ident)) {
      return true;
    }
  }
  return false;
};
pp$8.isAsyncFunction = function() {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, after;
  return !lineBreak.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !(isIdentifierChar(after = this.fullCharCodeAt(next + 8)) || after === 92));
};
pp$8.isUsingKeyword = function(isAwaitUsing, isFor) {
  if (this.options.ecmaVersion < 17 || !this.isContextual(isAwaitUsing ? "await" : "using")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length;
  if (lineBreak.test(this.input.slice(this.pos, next))) {
    return false;
  }
  if (isAwaitUsing) {
    var usingEndPos = next + 5, after;
    if (this.input.slice(next, usingEndPos) !== "using" || usingEndPos === this.input.length || isIdentifierChar(after = this.fullCharCodeAt(usingEndPos)) || after === 92) {
      return false;
    }
    skipWhiteSpace.lastIndex = usingEndPos;
    var skipAfterUsing = skipWhiteSpace.exec(this.input);
    next = usingEndPos + skipAfterUsing[0].length;
    if (skipAfterUsing && lineBreak.test(this.input.slice(usingEndPos, next))) {
      return false;
    }
  }
  var ch2 = this.fullCharCodeAt(next);
  if (!isIdentifierStart(ch2) && ch2 !== 92) {
    return false;
  }
  var idStart = next;
  do {
    next += ch2 <= 65535 ? 1 : 2;
  } while (isIdentifierChar(ch2 = this.fullCharCodeAt(next)));
  if (ch2 === 92) {
    return true;
  }
  var id2 = this.input.slice(idStart, next);
  if (keywordRelationalOperator.test(id2)) {
    return false;
  }
  if (isFor && !isAwaitUsing && id2 === "of") {
    skipWhiteSpace.lastIndex = next;
    var skipAfterOf = skipWhiteSpace.exec(this.input);
    next = next + skipAfterOf[0].length;
    if (this.input.charCodeAt(next) !== 61 || // Check for ==, === and => operators
    (ch2 = this.input.charCodeAt(next + 1)) === 61 || ch2 === 62) {
      return false;
    }
  }
  return true;
};
pp$8.isAwaitUsing = function(isFor) {
  return this.isUsingKeyword(true, isFor);
};
pp$8.isUsing = function(isFor) {
  return this.isUsingKeyword(false, isFor);
};
pp$8.parseStatement = function(context, topLevel, exports$1) {
  var starttype = this.type, node = this.startNode(), kind;
  if (this.isLet(context)) {
    starttype = types$1._var;
    kind = "let";
  }
  switch (starttype) {
    case types$1._break:
    case types$1._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case types$1._debugger:
      return this.parseDebuggerStatement(node);
    case types$1._do:
      return this.parseDoStatement(node);
    case types$1._for:
      return this.parseForStatement(node);
    case types$1._function:
      if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
        this.unexpected();
      }
      return this.parseFunctionStatement(node, false, !context);
    case types$1._class:
      if (context) {
        this.unexpected();
      }
      return this.parseClass(node, true);
    case types$1._if:
      return this.parseIfStatement(node);
    case types$1._return:
      return this.parseReturnStatement(node);
    case types$1._switch:
      return this.parseSwitchStatement(node);
    case types$1._throw:
      return this.parseThrowStatement(node);
    case types$1._try:
      return this.parseTryStatement(node);
    case types$1._const:
    case types$1._var:
      kind = kind || this.value;
      if (context && kind !== "var") {
        this.unexpected();
      }
      return this.parseVarStatement(node, kind);
    case types$1._while:
      return this.parseWhileStatement(node);
    case types$1._with:
      return this.parseWithStatement(node);
    case types$1.braceL:
      return this.parseBlock(true, node);
    case types$1.semi:
      return this.parseEmptyStatement(node);
    case types$1._export:
    case types$1._import:
      if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
        skipWhiteSpace.lastIndex = this.pos;
        var skip = skipWhiteSpace.exec(this.input);
        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
        if (nextCh === 40 || nextCh === 46) {
          return this.parseExpressionStatement(node, this.parseExpression());
        }
      }
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) {
          this.raise(this.start, "'import' and 'export' may only appear at the top level");
        }
        if (!this.inModule) {
          this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
        }
      }
      return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports$1);
    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    default:
      if (this.isAsyncFunction()) {
        if (context) {
          this.unexpected();
        }
        this.next();
        return this.parseFunctionStatement(node, true, !context);
      }
      var usingKind = this.isAwaitUsing(false) ? "await using" : this.isUsing(false) ? "using" : null;
      if (usingKind) {
        if (!this.allowUsing) {
          this.raise(this.start, "Using declaration cannot appear in the top level when source type is `script` or in the bare case statement");
        }
        if (context) {
          this.raise(this.start, "Using declaration is not allowed in single-statement positions");
        }
        if (usingKind === "await using") {
          if (!this.canAwait) {
            this.raise(this.start, "Await using cannot appear outside of async function");
          }
          this.next();
        }
        this.next();
        this.parseVar(node, false, usingKind);
        this.semicolon();
        return this.finishNode(node, "VariableDeclaration");
      }
      var maybeName = this.value, expr = this.parseExpression();
      if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon)) {
        return this.parseLabeledStatement(node, maybeName, expr, context);
      } else {
        return this.parseExpressionStatement(node, expr);
      }
  }
};
pp$8.parseBreakContinueStatement = function(node, keyword) {
  var isBreak = keyword === "break";
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.label = null;
  } else if (this.type !== types$1.name) {
    this.unexpected();
  } else {
    node.label = this.parseIdent();
    this.semicolon();
  }
  var i2 = 0;
  for (; i2 < this.labels.length; ++i2) {
    var lab = this.labels[i2];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) {
        break;
      }
      if (node.label && isBreak) {
        break;
      }
    }
  }
  if (i2 === this.labels.length) {
    this.raise(node.start, "Unsyntactic " + keyword);
  }
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
};
pp$8.parseDebuggerStatement = function(node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement");
};
pp$8.parseDoStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("do");
  this.labels.pop();
  this.expect(types$1._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) {
    this.eat(types$1.semi);
  } else {
    this.semicolon();
  }
  return this.finishNode(node, "DoWhileStatement");
};
pp$8.parseForStatement = function(node) {
  this.next();
  var awaitAt = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
  this.labels.push(loopLabel);
  this.enterScope(0);
  this.expect(types$1.parenL);
  if (this.type === types$1.semi) {
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, null);
  }
  var isLet = this.isLet();
  if (this.type === types$1._var || this.type === types$1._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    this.next();
    this.parseVar(init$1, true, kind);
    this.finishNode(init$1, "VariableDeclaration");
    return this.parseForAfterInit(node, init$1, awaitAt);
  }
  var startsWithLet = this.isContextual("let"), isForOf = false;
  var usingKind = this.isUsing(true) ? "using" : this.isAwaitUsing(true) ? "await using" : null;
  if (usingKind) {
    var init$2 = this.startNode();
    this.next();
    if (usingKind === "await using") {
      if (!this.canAwait) {
        this.raise(this.start, "Await using cannot appear outside of async function");
      }
      this.next();
    }
    this.parseVar(init$2, true, usingKind);
    this.finishNode(init$2, "VariableDeclaration");
    return this.parseForAfterInit(node, init$2, awaitAt);
  }
  var containsEsc = this.containsEsc;
  var refDestructuringErrors = new DestructuringErrors();
  var initPos = this.start;
  var init = awaitAt > -1 ? this.parseExprSubscripts(refDestructuringErrors, "await") : this.parseExpression(true, refDestructuringErrors);
  if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    if (awaitAt > -1) {
      if (this.type === types$1._in) {
        this.unexpected(awaitAt);
      }
      node.await = true;
    } else if (isForOf && this.options.ecmaVersion >= 8) {
      if (init.start === initPos && !containsEsc && init.type === "Identifier" && init.name === "async") {
        this.unexpected();
      } else if (this.options.ecmaVersion >= 9) {
        node.await = false;
      }
    }
    if (startsWithLet && isForOf) {
      this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'.");
    }
    this.toAssignable(init, false, refDestructuringErrors);
    this.checkLValPattern(init);
    return this.parseForIn(node, init);
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$8.parseForAfterInit = function(node, init, awaitAt) {
  if ((this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init.declarations.length === 1) {
    if (this.type === types$1._in) {
      if ((init.kind === "using" || init.kind === "await using") && !init.declarations[0].init) {
        this.raise(this.start, "Using declaration is not allowed in for-in loops");
      }
      if (this.options.ecmaVersion >= 9 && awaitAt > -1) {
        this.unexpected(awaitAt);
      }
    } else if (this.options.ecmaVersion >= 9) {
      node.await = awaitAt > -1;
    }
    return this.parseForIn(node, init);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
  this.next();
  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync);
};
pp$8.parseIfStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  node.consequent = this.parseStatement("if");
  node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
  return this.finishNode(node, "IfStatement");
};
pp$8.parseReturnStatement = function(node) {
  if (!this.allowReturn) {
    this.raise(this.start, "'return' outside of function");
  }
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.argument = null;
  } else {
    node.argument = this.parseExpression();
    this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};
pp$8.parseSwitchStatement = function(node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(types$1.braceL);
  this.labels.push(switchLabel);
  this.enterScope(SCOPE_SWITCH);
  var cur;
  for (var sawDefault = false; this.type !== types$1.braceR; ) {
    if (this.type === types$1._case || this.type === types$1._default) {
      var isCase = this.type === types$1._case;
      if (cur) {
        this.finishNode(cur, "SwitchCase");
      }
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) {
          this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
        }
        sawDefault = true;
        cur.test = null;
      }
      this.expect(types$1.colon);
    } else {
      if (!cur) {
        this.unexpected();
      }
      cur.consequent.push(this.parseStatement(null));
    }
  }
  this.exitScope();
  if (cur) {
    this.finishNode(cur, "SwitchCase");
  }
  this.next();
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement");
};
pp$8.parseThrowStatement = function(node) {
  this.next();
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) {
    this.raise(this.lastTokEnd, "Illegal newline after throw");
  }
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement");
};
var empty$1 = [];
pp$8.parseCatchClauseParam = function() {
  var param = this.parseBindingAtom();
  var simple = param.type === "Identifier";
  this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
  this.checkLValPattern(param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
  this.expect(types$1.parenR);
  return param;
};
pp$8.parseTryStatement = function(node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === types$1._catch) {
    var clause = this.startNode();
    this.next();
    if (this.eat(types$1.parenL)) {
      clause.param = this.parseCatchClauseParam();
    } else {
      if (this.options.ecmaVersion < 10) {
        this.unexpected();
      }
      clause.param = null;
      this.enterScope(0);
    }
    clause.body = this.parseBlock(false);
    this.exitScope();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer) {
    this.raise(node.start, "Missing catch or finally clause");
  }
  return this.finishNode(node, "TryStatement");
};
pp$8.parseVarStatement = function(node, kind, allowMissingInitializer) {
  this.next();
  this.parseVar(node, false, kind, allowMissingInitializer);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};
pp$8.parseWhileStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("while");
  this.labels.pop();
  return this.finishNode(node, "WhileStatement");
};
pp$8.parseWithStatement = function(node) {
  if (this.strict) {
    this.raise(this.start, "'with' in strict mode");
  }
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement("with");
  return this.finishNode(node, "WithStatement");
};
pp$8.parseEmptyStatement = function(node) {
  this.next();
  return this.finishNode(node, "EmptyStatement");
};
pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
  for (var i$1 = 0, list2 = this.labels; i$1 < list2.length; i$1 += 1) {
    var label = list2[i$1];
    if (label.name === maybeName) {
      this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    }
  }
  var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
  for (var i2 = this.labels.length - 1; i2 >= 0; i2--) {
    var label$1 = this.labels[i2];
    if (label$1.statementStart === node.start) {
      label$1.statementStart = this.start;
      label$1.kind = kind;
    } else {
      break;
    }
  }
  this.labels.push({ name: maybeName, kind, statementStart: this.start });
  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement");
};
pp$8.parseExpressionStatement = function(node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement");
};
pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
  if (createNewLexicalScope === void 0) createNewLexicalScope = true;
  if (node === void 0) node = this.startNode();
  node.body = [];
  this.expect(types$1.braceL);
  if (createNewLexicalScope) {
    this.enterScope(0);
  }
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  if (exitStrict) {
    this.strict = false;
  }
  this.next();
  if (createNewLexicalScope) {
    this.exitScope();
  }
  return this.finishNode(node, "BlockStatement");
};
pp$8.parseFor = function(node, init) {
  node.init = init;
  this.expect(types$1.semi);
  node.test = this.type === types$1.semi ? null : this.parseExpression();
  this.expect(types$1.semi);
  node.update = this.type === types$1.parenR ? null : this.parseExpression();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};
pp$8.parseForIn = function(node, init) {
  var isForIn = this.type === types$1._in;
  this.next();
  if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
    this.raise(
      init.start,
      (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer"
    );
  }
  node.left = init;
  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
};
pp$8.parseVar = function(node, isFor, kind, allowMissingInitializer) {
  node.declarations = [];
  node.kind = kind;
  for (; ; ) {
    var decl = this.startNode();
    this.parseVarId(decl, kind);
    if (this.eat(types$1.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (!allowMissingInitializer && kind === "const" && !(this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (!allowMissingInitializer && (kind === "using" || kind === "await using") && this.options.ecmaVersion >= 17 && this.type !== types$1._in && !this.isContextual("of")) {
      this.raise(this.lastTokEnd, "Missing initializer in " + kind + " declaration");
    } else if (!allowMissingInitializer && decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(types$1.comma)) {
      break;
    }
  }
  return node;
};
pp$8.parseVarId = function(decl, kind) {
  decl.id = kind === "using" || kind === "await using" ? this.parseIdent() : this.parseBindingAtom();
  this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
};
var FUNC_STATEMENT = 1;
var FUNC_HANGING_STATEMENT = 2;
var FUNC_NULLABLE_ID = 4;
pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    if (this.type === types$1.star && statement & FUNC_HANGING_STATEMENT) {
      this.unexpected();
    }
    node.generator = this.eat(types$1.star);
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  if (statement & FUNC_STATEMENT) {
    node.id = statement & FUNC_NULLABLE_ID && this.type !== types$1.name ? null : this.parseIdent();
    if (node.id && !(statement & FUNC_HANGING_STATEMENT)) {
      this.checkLValSimple(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION);
    }
  }
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(node.async, node.generator));
  if (!(statement & FUNC_STATEMENT)) {
    node.id = this.type === types$1.name ? this.parseIdent() : null;
  }
  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, statement & FUNC_STATEMENT ? "FunctionDeclaration" : "FunctionExpression");
};
pp$8.parseFunctionParams = function(node) {
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
};
pp$8.parseClass = function(node, isStatement) {
  this.next();
  var oldStrict = this.strict;
  this.strict = true;
  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var privateNameMap = this.enterClassBody();
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(types$1.braceL);
  while (this.type !== types$1.braceR) {
    var element = this.parseClassElement(node.superClass !== null);
    if (element) {
      classBody.body.push(element);
      if (element.type === "MethodDefinition" && element.kind === "constructor") {
        if (hadConstructor) {
          this.raiseRecoverable(element.start, "Duplicate constructor in the same class");
        }
        hadConstructor = true;
      } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
        this.raiseRecoverable(element.key.start, "Identifier '#" + element.key.name + "' has already been declared");
      }
    }
  }
  this.strict = oldStrict;
  this.next();
  node.body = this.finishNode(classBody, "ClassBody");
  this.exitClassBody();
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};
pp$8.parseClassElement = function(constructorAllowsSuper) {
  if (this.eat(types$1.semi)) {
    return null;
  }
  var ecmaVersion2 = this.options.ecmaVersion;
  var node = this.startNode();
  var keyName = "";
  var isGenerator = false;
  var isAsync = false;
  var kind = "method";
  var isStatic = false;
  if (this.eatContextual("static")) {
    if (ecmaVersion2 >= 13 && this.eat(types$1.braceL)) {
      this.parseClassStaticBlock(node);
      return node;
    }
    if (this.isClassElementNameStart() || this.type === types$1.star) {
      isStatic = true;
    } else {
      keyName = "static";
    }
  }
  node.static = isStatic;
  if (!keyName && ecmaVersion2 >= 8 && this.eatContextual("async")) {
    if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
      isAsync = true;
    } else {
      keyName = "async";
    }
  }
  if (!keyName && (ecmaVersion2 >= 9 || !isAsync) && this.eat(types$1.star)) {
    isGenerator = true;
  }
  if (!keyName && !isAsync && !isGenerator) {
    var lastValue = this.value;
    if (this.eatContextual("get") || this.eatContextual("set")) {
      if (this.isClassElementNameStart()) {
        kind = lastValue;
      } else {
        keyName = lastValue;
      }
    }
  }
  if (keyName) {
    node.computed = false;
    node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
    node.key.name = keyName;
    this.finishNode(node.key, "Identifier");
  } else {
    this.parseClassElementName(node);
  }
  if (ecmaVersion2 < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
    var isConstructor = !node.static && checkKeyName(node, "constructor");
    var allowsDirectSuper = isConstructor && constructorAllowsSuper;
    if (isConstructor && kind !== "method") {
      this.raise(node.key.start, "Constructor can't have get/set modifier");
    }
    node.kind = isConstructor ? "constructor" : kind;
    this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
  } else {
    this.parseClassField(node);
  }
  return node;
};
pp$8.isClassElementNameStart = function() {
  return this.type === types$1.name || this.type === types$1.privateId || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword;
};
pp$8.parseClassElementName = function(element) {
  if (this.type === types$1.privateId) {
    if (this.value === "constructor") {
      this.raise(this.start, "Classes can't have an element named '#constructor'");
    }
    element.computed = false;
    element.key = this.parsePrivateIdent();
  } else {
    this.parsePropertyName(element);
  }
};
pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
  var key = method.key;
  if (method.kind === "constructor") {
    if (isGenerator) {
      this.raise(key.start, "Constructor can't be a generator");
    }
    if (isAsync) {
      this.raise(key.start, "Constructor can't be an async method");
    }
  } else if (method.static && checkKeyName(method, "prototype")) {
    this.raise(key.start, "Classes may not have a static property named prototype");
  }
  var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
  if (method.kind === "get" && value.params.length !== 0) {
    this.raiseRecoverable(value.start, "getter should have no params");
  }
  if (method.kind === "set" && value.params.length !== 1) {
    this.raiseRecoverable(value.start, "setter should have exactly one param");
  }
  if (method.kind === "set" && value.params[0].type === "RestElement") {
    this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params");
  }
  return this.finishNode(method, "MethodDefinition");
};
pp$8.parseClassField = function(field) {
  if (checkKeyName(field, "constructor")) {
    this.raise(field.key.start, "Classes can't have a field named 'constructor'");
  } else if (field.static && checkKeyName(field, "prototype")) {
    this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
  }
  if (this.eat(types$1.eq)) {
    this.enterScope(SCOPE_CLASS_FIELD_INIT | SCOPE_SUPER);
    field.value = this.parseMaybeAssign();
    this.exitScope();
  } else {
    field.value = null;
  }
  this.semicolon();
  return this.finishNode(field, "PropertyDefinition");
};
pp$8.parseClassStaticBlock = function(node) {
  node.body = [];
  var oldLabels = this.labels;
  this.labels = [];
  this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  this.next();
  this.exitScope();
  this.labels = oldLabels;
  return this.finishNode(node, "StaticBlock");
};
pp$8.parseClassId = function(node, isStatement) {
  if (this.type === types$1.name) {
    node.id = this.parseIdent();
    if (isStatement) {
      this.checkLValSimple(node.id, BIND_LEXICAL, false);
    }
  } else {
    if (isStatement === true) {
      this.unexpected();
    }
    node.id = null;
  }
};
pp$8.parseClassSuper = function(node) {
  node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;
};
pp$8.enterClassBody = function() {
  var element = { declared: /* @__PURE__ */ Object.create(null), used: [] };
  this.privateNameStack.push(element);
  return element.declared;
};
pp$8.exitClassBody = function() {
  var ref2 = this.privateNameStack.pop();
  var declared = ref2.declared;
  var used = ref2.used;
  if (!this.options.checkPrivateFields) {
    return;
  }
  var len = this.privateNameStack.length;
  var parent = len === 0 ? null : this.privateNameStack[len - 1];
  for (var i2 = 0; i2 < used.length; ++i2) {
    var id2 = used[i2];
    if (!hasOwn(declared, id2.name)) {
      if (parent) {
        parent.used.push(id2);
      } else {
        this.raiseRecoverable(id2.start, "Private field '#" + id2.name + "' must be declared in an enclosing class");
      }
    }
  }
};
function isPrivateNameConflicted(privateNameMap, element) {
  var name = element.key.name;
  var curr = privateNameMap[name];
  var next = "true";
  if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
    next = (element.static ? "s" : "i") + element.kind;
  }
  if (curr === "iget" && next === "iset" || curr === "iset" && next === "iget" || curr === "sget" && next === "sset" || curr === "sset" && next === "sget") {
    privateNameMap[name] = "true";
    return false;
  } else if (!curr) {
    privateNameMap[name] = next;
    return false;
  } else {
    return true;
  }
}
function checkKeyName(node, name) {
  var computed = node.computed;
  var key = node.key;
  return !computed && (key.type === "Identifier" && key.name === name || key.type === "Literal" && key.value === name);
}
pp$8.parseExportAllDeclaration = function(node, exports$1) {
  if (this.options.ecmaVersion >= 11) {
    if (this.eatContextual("as")) {
      node.exported = this.parseModuleExportName();
      this.checkExport(exports$1, node.exported, this.lastTokStart);
    } else {
      node.exported = null;
    }
  }
  this.expectContextual("from");
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.source = this.parseExprAtom();
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ExportAllDeclaration");
};
pp$8.parseExport = function(node, exports$1) {
  this.next();
  if (this.eat(types$1.star)) {
    return this.parseExportAllDeclaration(node, exports$1);
  }
  if (this.eat(types$1._default)) {
    this.checkExport(exports$1, "default", this.lastTokStart);
    node.declaration = this.parseExportDefaultDeclaration();
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseExportDeclaration(node);
    if (node.declaration.type === "VariableDeclaration") {
      this.checkVariableExport(exports$1, node.declaration.declarations);
    } else {
      this.checkExport(exports$1, node.declaration.id, node.declaration.id.start);
    }
    node.specifiers = [];
    node.source = null;
    if (this.options.ecmaVersion >= 16) {
      node.attributes = [];
    }
  } else {
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers(exports$1);
    if (this.eatContextual("from")) {
      if (this.type !== types$1.string) {
        this.unexpected();
      }
      node.source = this.parseExprAtom();
      if (this.options.ecmaVersion >= 16) {
        node.attributes = this.parseWithClause();
      }
    } else {
      for (var i2 = 0, list2 = node.specifiers; i2 < list2.length; i2 += 1) {
        var spec = list2[i2];
        this.checkUnreserved(spec.local);
        this.checkLocalExport(spec.local);
        if (spec.local.type === "Literal") {
          this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
        }
      }
      node.source = null;
      if (this.options.ecmaVersion >= 16) {
        node.attributes = [];
      }
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};
pp$8.parseExportDeclaration = function(node) {
  return this.parseStatement(null);
};
pp$8.parseExportDefaultDeclaration = function() {
  var isAsync;
  if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
    var fNode = this.startNode();
    this.next();
    if (isAsync) {
      this.next();
    }
    return this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
  } else if (this.type === types$1._class) {
    var cNode = this.startNode();
    return this.parseClass(cNode, "nullableID");
  } else {
    var declaration = this.parseMaybeAssign();
    this.semicolon();
    return declaration;
  }
};
pp$8.checkExport = function(exports$1, name, pos) {
  if (!exports$1) {
    return;
  }
  if (typeof name !== "string") {
    name = name.type === "Identifier" ? name.name : name.value;
  }
  if (hasOwn(exports$1, name)) {
    this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
  }
  exports$1[name] = true;
};
pp$8.checkPatternExport = function(exports$1, pat) {
  var type = pat.type;
  if (type === "Identifier") {
    this.checkExport(exports$1, pat, pat.start);
  } else if (type === "ObjectPattern") {
    for (var i2 = 0, list2 = pat.properties; i2 < list2.length; i2 += 1) {
      var prop = list2[i2];
      this.checkPatternExport(exports$1, prop);
    }
  } else if (type === "ArrayPattern") {
    for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
      var elt = list$1[i$1];
      if (elt) {
        this.checkPatternExport(exports$1, elt);
      }
    }
  } else if (type === "Property") {
    this.checkPatternExport(exports$1, pat.value);
  } else if (type === "AssignmentPattern") {
    this.checkPatternExport(exports$1, pat.left);
  } else if (type === "RestElement") {
    this.checkPatternExport(exports$1, pat.argument);
  }
};
pp$8.checkVariableExport = function(exports$1, decls) {
  if (!exports$1) {
    return;
  }
  for (var i2 = 0, list2 = decls; i2 < list2.length; i2 += 1) {
    var decl = list2[i2];
    this.checkPatternExport(exports$1, decl.id);
  }
};
pp$8.shouldParseExportStatement = function() {
  return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
};
pp$8.parseExportSpecifier = function(exports$1) {
  var node = this.startNode();
  node.local = this.parseModuleExportName();
  node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
  this.checkExport(
    exports$1,
    node.exported,
    node.exported.start
  );
  return this.finishNode(node, "ExportSpecifier");
};
pp$8.parseExportSpecifiers = function(exports$1) {
  var nodes = [], first = true;
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseExportSpecifier(exports$1));
  }
  return nodes;
};
pp$8.parseImport = function(node) {
  this.next();
  if (this.type === types$1.string) {
    node.specifiers = empty$1;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
  }
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};
pp$8.parseImportSpecifier = function() {
  var node = this.startNode();
  node.imported = this.parseModuleExportName();
  if (this.eatContextual("as")) {
    node.local = this.parseIdent();
  } else {
    this.checkUnreserved(node.imported);
    node.local = node.imported;
  }
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportSpecifier");
};
pp$8.parseImportDefaultSpecifier = function() {
  var node = this.startNode();
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportDefaultSpecifier");
};
pp$8.parseImportNamespaceSpecifier = function() {
  var node = this.startNode();
  this.next();
  this.expectContextual("as");
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportNamespaceSpecifier");
};
pp$8.parseImportSpecifiers = function() {
  var nodes = [], first = true;
  if (this.type === types$1.name) {
    nodes.push(this.parseImportDefaultSpecifier());
    if (!this.eat(types$1.comma)) {
      return nodes;
    }
  }
  if (this.type === types$1.star) {
    nodes.push(this.parseImportNamespaceSpecifier());
    return nodes;
  }
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseImportSpecifier());
  }
  return nodes;
};
pp$8.parseWithClause = function() {
  var nodes = [];
  if (!this.eat(types$1._with)) {
    return nodes;
  }
  this.expect(types$1.braceL);
  var attributeKeys = {};
  var first = true;
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var attr = this.parseImportAttribute();
    var keyName = attr.key.type === "Identifier" ? attr.key.name : attr.key.value;
    if (hasOwn(attributeKeys, keyName)) {
      this.raiseRecoverable(attr.key.start, "Duplicate attribute key '" + keyName + "'");
    }
    attributeKeys[keyName] = true;
    nodes.push(attr);
  }
  return nodes;
};
pp$8.parseImportAttribute = function() {
  var node = this.startNode();
  node.key = this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
  this.expect(types$1.colon);
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.value = this.parseExprAtom();
  return this.finishNode(node, "ImportAttribute");
};
pp$8.parseModuleExportName = function() {
  if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
    var stringLiteral = this.parseLiteral(this.value);
    if (loneSurrogate.test(stringLiteral.value)) {
      this.raise(stringLiteral.start, "An export name cannot include a lone surrogate.");
    }
    return stringLiteral;
  }
  return this.parseIdent(true);
};
pp$8.adaptDirectivePrologue = function(statements) {
  for (var i2 = 0; i2 < statements.length && this.isDirectiveCandidate(statements[i2]); ++i2) {
    statements[i2].directive = statements[i2].expression.raw.slice(1, -1);
  }
};
pp$8.isDirectiveCandidate = function(statement) {
  return this.options.ecmaVersion >= 5 && statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && // Reject parenthesized strings.
  (this.input[statement.start] === '"' || this.input[statement.start] === "'");
};
var pp$7 = Parser.prototype;
pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
        if (this.inAsync && node.name === "await") {
          this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
        }
        break;
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break;
      case "ObjectExpression":
        node.type = "ObjectPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        for (var i2 = 0, list2 = node.properties; i2 < list2.length; i2 += 1) {
          var prop = list2[i2];
          this.toAssignable(prop, isBinding);
          if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
            this.raise(prop.argument.start, "Unexpected token");
          }
        }
        break;
      case "Property":
        if (node.kind !== "init") {
          this.raise(node.key.start, "Object pattern can't contain getter or setter");
        }
        this.toAssignable(node.value, isBinding);
        break;
      case "ArrayExpression":
        node.type = "ArrayPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        this.toAssignableList(node.elements, isBinding);
        break;
      case "SpreadElement":
        node.type = "RestElement";
        this.toAssignable(node.argument, isBinding);
        if (node.argument.type === "AssignmentPattern") {
          this.raise(node.argument.start, "Rest elements cannot have a default value");
        }
        break;
      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isBinding);
        break;
      case "ParenthesizedExpression":
        this.toAssignable(node.expression, isBinding, refDestructuringErrors);
        break;
      case "ChainExpression":
        this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
        break;
      case "MemberExpression":
        if (!isBinding) {
          break;
        }
      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  } else if (refDestructuringErrors) {
    this.checkPatternErrors(refDestructuringErrors, true);
  }
  return node;
};
pp$7.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  for (var i2 = 0; i2 < end; i2++) {
    var elt = exprList[i2];
    if (elt) {
      this.toAssignable(elt, isBinding);
    }
  }
  if (end) {
    var last = exprList[end - 1];
    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier") {
      this.unexpected(last.argument.start);
    }
  }
  return exprList;
};
pp$7.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
  return this.finishNode(node, "SpreadElement");
};
pp$7.parseRestBinding = function() {
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion === 6 && this.type !== types$1.name) {
    this.unexpected();
  }
  node.argument = this.parseBindingAtom();
  return this.finishNode(node, "RestElement");
};
pp$7.parseBindingAtom = function() {
  if (this.options.ecmaVersion >= 6) {
    switch (this.type) {
      case types$1.bracketL:
        var node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(types$1.bracketR, true, true);
        return this.finishNode(node, "ArrayPattern");
      case types$1.braceL:
        return this.parseObj(true);
    }
  }
  return this.parseIdent();
};
pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowModifiers) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (first) {
      first = false;
    } else {
      this.expect(types$1.comma);
    }
    if (allowEmpty && this.type === types$1.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === types$1.ellipsis) {
      var rest = this.parseRestBinding();
      this.parseBindingListItem(rest);
      elts.push(rest);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      this.expect(close);
      break;
    } else {
      elts.push(this.parseAssignableListItem(allowModifiers));
    }
  }
  return elts;
};
pp$7.parseAssignableListItem = function(allowModifiers) {
  var elem = this.parseMaybeDefault(this.start, this.startLoc);
  this.parseBindingListItem(elem);
  return elem;
};
pp$7.parseBindingListItem = function(param) {
  return param;
};
pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) {
    return left;
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};
pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  var isBind = bindingType !== BIND_NONE;
  switch (expr.type) {
    case "Identifier":
      if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
        this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      }
      if (isBind) {
        if (bindingType === BIND_LEXICAL && expr.name === "let") {
          this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
        }
        if (checkClashes) {
          if (hasOwn(checkClashes, expr.name)) {
            this.raiseRecoverable(expr.start, "Argument name clash");
          }
          checkClashes[expr.name] = true;
        }
        if (bindingType !== BIND_OUTSIDE) {
          this.declareName(expr.name, bindingType, expr.start);
        }
      }
      break;
    case "ChainExpression":
      this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
      break;
    case "MemberExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding member expression");
      }
      break;
    case "ParenthesizedExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding parenthesized expression");
      }
      return this.checkLValSimple(expr.expression, bindingType, checkClashes);
    default:
      this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
  }
};
pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "ObjectPattern":
      for (var i2 = 0, list2 = expr.properties; i2 < list2.length; i2 += 1) {
        var prop = list2[i2];
        this.checkLValInnerPattern(prop, bindingType, checkClashes);
      }
      break;
    case "ArrayPattern":
      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
        var elem = list$1[i$1];
        if (elem) {
          this.checkLValInnerPattern(elem, bindingType, checkClashes);
        }
      }
      break;
    default:
      this.checkLValSimple(expr, bindingType, checkClashes);
  }
};
pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "Property":
      this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
      break;
    case "AssignmentPattern":
      this.checkLValPattern(expr.left, bindingType, checkClashes);
      break;
    case "RestElement":
      this.checkLValPattern(expr.argument, bindingType, checkClashes);
      break;
    default:
      this.checkLValPattern(expr, bindingType, checkClashes);
  }
};
var TokContext = function TokContext2(token, isExpr, preserveSpace, override, generator) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
  this.generator = !!generator;
};
var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function(p) {
    return p.tryReadTemplateToken();
  }),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
};
var pp$6 = Parser.prototype;
pp$6.initialContext = function() {
  return [types.b_stat];
};
pp$6.curContext = function() {
  return this.context[this.context.length - 1];
};
pp$6.braceIsBlock = function(prevType) {
  var parent = this.curContext();
  if (parent === types.f_expr || parent === types.f_stat) {
    return true;
  }
  if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr)) {
    return !parent.isExpr;
  }
  if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed) {
    return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  }
  if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow) {
    return true;
  }
  if (prevType === types$1.braceL) {
    return parent === types.b_stat;
  }
  if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name) {
    return false;
  }
  return !this.exprAllowed;
};
pp$6.inGeneratorContext = function() {
  for (var i2 = this.context.length - 1; i2 >= 1; i2--) {
    var context = this.context[i2];
    if (context.token === "function") {
      return context.generator;
    }
  }
  return false;
};
pp$6.updateContext = function(prevType) {
  var update, type = this.type;
  if (type.keyword && prevType === types$1.dot) {
    this.exprAllowed = false;
  } else if (update = type.updateContext) {
    update.call(this, prevType);
  } else {
    this.exprAllowed = type.beforeExpr;
  }
};
pp$6.overrideContext = function(tokenCtx) {
  if (this.curContext() !== tokenCtx) {
    this.context[this.context.length - 1] = tokenCtx;
  }
};
types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
  if (this.context.length === 1) {
    this.exprAllowed = true;
    return;
  }
  var out2 = this.context.pop();
  if (out2 === types.b_stat && this.curContext().token === "function") {
    out2 = this.context.pop();
  }
  this.exprAllowed = !out2.isExpr;
};
types$1.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};
types$1.dollarBraceL.updateContext = function() {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};
types$1.parenL.updateContext = function(prevType) {
  var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};
types$1.incDec.updateContext = function() {
};
types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== types$1._else && !(prevType === types$1.semi && this.curContext() !== types.p_stat) && !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat)) {
    this.context.push(types.f_expr);
  } else {
    this.context.push(types.f_stat);
  }
  this.exprAllowed = false;
};
types$1.colon.updateContext = function() {
  if (this.curContext().token === "function") {
    this.context.pop();
  }
  this.exprAllowed = true;
};
types$1.backQuote.updateContext = function() {
  if (this.curContext() === types.q_tmpl) {
    this.context.pop();
  } else {
    this.context.push(types.q_tmpl);
  }
  this.exprAllowed = false;
};
types$1.star.updateContext = function(prevType) {
  if (prevType === types$1._function) {
    var index = this.context.length - 1;
    if (this.context[index] === types.f_expr) {
      this.context[index] = types.f_expr_gen;
    } else {
      this.context[index] = types.f_gen;
    }
  }
  this.exprAllowed = true;
};
types$1.name.updateContext = function(prevType) {
  var allowed = false;
  if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
    if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
      allowed = true;
    }
  }
  this.exprAllowed = allowed;
};
var pp$5 = Parser.prototype;
pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
    return;
  }
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
    return;
  }
  var key = prop.key;
  var name;
  switch (key.type) {
    case "Identifier":
      name = key.name;
      break;
    case "Literal":
      name = String(key.value);
      break;
    default:
      return;
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) {
        if (refDestructuringErrors) {
          if (refDestructuringErrors.doubleProto < 0) {
            refDestructuringErrors.doubleProto = key.start;
          }
        } else {
          this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
        }
      }
      propHash.proto = true;
    }
    return;
  }
  name = "$" + name;
  var other = propHash[name];
  if (other) {
    var redefinition;
    if (kind === "init") {
      redefinition = this.strict && other.init || other.get || other.set;
    } else {
      redefinition = other.init || other[kind];
    }
    if (redefinition) {
      this.raiseRecoverable(key.start, "Redefinition of property");
    }
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};
pp$5.parseExpression = function(forInit, refDestructuringErrors) {
  var this$1$1 = this;
  return this.catchStackOverflow(function() {
    var startPos = this$1$1.start, startLoc = this$1$1.startLoc;
    var expr = this$1$1.parseMaybeAssign(forInit, refDestructuringErrors);
    if (this$1$1.type === types$1.comma) {
      var node = this$1$1.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this$1$1.eat(types$1.comma)) {
        node.expressions.push(this$1$1.parseMaybeAssign(forInit, refDestructuringErrors));
      }
      return this$1$1.finishNode(node, "SequenceExpression");
    }
    return expr;
  });
};
pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) {
      return this.parseYield(forInit);
    } else {
      this.exprAllowed = false;
    }
  }
  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    oldDoubleProto = refDestructuringErrors.doubleProto;
    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors();
    ownDestructuringErrors = true;
  }
  var startPos = this.start, startLoc = this.startLoc;
  if (this.type === types$1.parenL || this.type === types$1.name) {
    this.potentialArrowAt = this.start;
    this.potentialArrowInForAwait = forInit === "await";
  }
  var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
  if (afterLeftParse) {
    left = afterLeftParse.call(this, left, startPos, startLoc);
  }
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    if (this.type === types$1.eq) {
      left = this.toAssignable(left, false, refDestructuringErrors);
    }
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
    }
    if (refDestructuringErrors.shorthandAssign >= left.start) {
      refDestructuringErrors.shorthandAssign = -1;
    }
    if (this.type === types$1.eq) {
      this.checkLValPattern(left);
    } else {
      this.checkLValSimple(left);
    }
    node.left = left;
    this.next();
    node.right = this.parseMaybeAssign(forInit);
    if (oldDoubleProto > -1) {
      refDestructuringErrors.doubleProto = oldDoubleProto;
    }
    return this.finishNode(node, "AssignmentExpression");
  } else {
    if (ownDestructuringErrors) {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
  }
  if (oldParenAssign > -1) {
    refDestructuringErrors.parenthesizedAssign = oldParenAssign;
  }
  if (oldTrailingComma > -1) {
    refDestructuringErrors.trailingComma = oldTrailingComma;
  }
  return left;
};
pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprOps(forInit, refDestructuringErrors);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  if (!(expr.type === "ArrowFunctionExpression" && expr.start === startPos) && this.eat(types$1.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(types$1.colon);
    node.alternate = this.parseMaybeAssign(forInit);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};
pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit);
};
pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
  var prec = this.type.binop;
  if (prec != null && (!forInit || this.type !== types$1._in)) {
    if (prec > minPrec) {
      var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
      var coalesce = this.type === types$1.coalesce;
      if (coalesce) {
        prec = types$1.logicalAND.binop;
      }
      var op2 = this.value;
      this.next();
      var startPos = this.start, startLoc = this.startLoc;
      var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op2, logical || coalesce);
      if (logical && this.type === types$1.coalesce || coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND)) {
        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
      }
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);
    }
  }
  return left;
};
pp$5.buildBinary = function(startPos, startLoc, left, right, op2, logical) {
  if (right.type === "PrivateIdentifier") {
    this.raise(right.start, "Private identifier can only be left side of binary expression");
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.operator = op2;
  node.right = right;
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
};
pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
  var startPos = this.start, startLoc = this.startLoc, expr;
  if (this.isContextual("await") && this.canAwait) {
    expr = this.parseAwait(forInit);
    sawUnary = true;
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === types$1.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true, update, forInit);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) {
      this.checkLValSimple(node.argument);
    } else if (this.strict && node.operator === "delete" && isLocalVariableAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
    } else if (node.operator === "delete" && isPrivateFieldAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Private fields can not be deleted");
    } else {
      sawUnary = true;
    }
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (!sawUnary && this.type === types$1.privateId) {
    if ((forInit || this.privateNameStack.length === 0) && this.options.checkPrivateFields) {
      this.unexpected();
    }
    expr = this.parsePrivateIdent();
    if (this.type !== types$1._in) {
      this.unexpected();
    }
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.operator = this.value;
      node$1.prefix = false;
      node$1.argument = expr;
      this.checkLValSimple(expr);
      this.next();
      expr = this.finishNode(node$1, "UpdateExpression");
    }
  }
  if (!incDec && this.eat(types$1.starstar)) {
    if (sawUnary) {
      this.unexpected(this.lastTokStart);
    } else {
      return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false);
    }
  } else {
    return expr;
  }
};
function isLocalVariableAccess(node) {
  return node.type === "Identifier" || node.type === "ParenthesizedExpression" && isLocalVariableAccess(node.expression);
}
function isPrivateFieldAccess(node) {
  return node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" || node.type === "ChainExpression" && isPrivateFieldAccess(node.expression) || node.type === "ParenthesizedExpression" && isPrivateFieldAccess(node.expression);
}
pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprAtom(refDestructuringErrors, forInit);
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
    return expr;
  }
  var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) {
      refDestructuringErrors.parenthesizedAssign = -1;
    }
    if (refDestructuringErrors.parenthesizedBind >= result.start) {
      refDestructuringErrors.parenthesizedBind = -1;
    }
    if (refDestructuringErrors.trailingComma >= result.start) {
      refDestructuringErrors.trailingComma = -1;
    }
  }
  return result;
};
pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" && this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && this.potentialArrowAt === base.start;
  var optionalChained = false;
  while (true) {
    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);
    if (element.optional) {
      optionalChained = true;
    }
    if (element === base || element.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        var chainNode = this.startNodeAt(startPos, startLoc);
        chainNode.expression = element;
        element = this.finishNode(chainNode, "ChainExpression");
      }
      return element;
    }
    base = element;
  }
};
pp$5.shouldParseAsyncArrow = function() {
  return !this.canInsertSemicolon() && this.eat(types$1.arrow);
};
pp$5.parseSubscriptAsyncArrow = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit);
};
pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
  var optionalSupported = this.options.ecmaVersion >= 11;
  var optional = optionalSupported && this.eat(types$1.questionDot);
  if (noCalls && optional) {
    this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
  }
  var computed = this.eat(types$1.bracketL);
  if (computed || optional && this.type !== types$1.parenL && this.type !== types$1.backQuote || this.eat(types$1.dot)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    if (computed) {
      node.property = this.parseExpression();
      this.expect(types$1.bracketR);
    } else if (this.type === types$1.privateId && base.type !== "Super") {
      node.property = this.parsePrivateIdent();
    } else {
      node.property = this.parseIdent(this.options.allowReserved !== "never");
    }
    node.computed = !!computed;
    if (optionalSupported) {
      node.optional = optional;
    }
    base = this.finishNode(node, "MemberExpression");
  } else if (!noCalls && this.eat(types$1.parenL)) {
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      if (this.awaitIdentPos > 0) {
        this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
      }
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    var node$1 = this.startNodeAt(startPos, startLoc);
    node$1.callee = base;
    node$1.arguments = exprList;
    if (optionalSupported) {
      node$1.optional = optional;
    }
    base = this.finishNode(node$1, "CallExpression");
  } else if (this.type === types$1.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
    }
    var node$2 = this.startNodeAt(startPos, startLoc);
    node$2.tag = base;
    node$2.quasi = this.parseTemplate({ isTagged: true });
    base = this.finishNode(node$2, "TaggedTemplateExpression");
  }
  return base;
};
pp$5.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {
  if (this.type === types$1.slash) {
    this.readRegexp();
  }
  var node, canBeArrow = this.potentialArrowAt === this.start;
  switch (this.type) {
    case types$1._super:
      if (!this.allowSuper) {
        this.raise(this.start, "'super' keyword outside a method");
      }
      node = this.startNode();
      this.next();
      if (this.type === types$1.parenL && !this.allowDirectSuper) {
        this.raise(node.start, "super() call outside constructor of a subclass");
      }
      if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL) {
        this.unexpected();
      }
      return this.finishNode(node, "Super");
    case types$1._this:
      node = this.startNode();
      this.next();
      return this.finishNode(node, "ThisExpression");
    case types$1.name:
      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
      var id2 = this.parseIdent(false);
      if (this.options.ecmaVersion >= 8 && !containsEsc && id2.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
        this.overrideContext(types.f_expr);
        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit);
      }
      if (canBeArrow && !this.canInsertSemicolon()) {
        if (this.eat(types$1.arrow)) {
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id2], false, forInit);
        }
        if (this.options.ecmaVersion >= 8 && id2.name === "async" && this.type === types$1.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
          id2 = this.parseIdent(false);
          if (this.canInsertSemicolon() || !this.eat(types$1.arrow)) {
            this.unexpected();
          }
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id2], true, forInit);
        }
      }
      return id2;
    case types$1.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;
    case types$1.num:
    case types$1.string:
      return this.parseLiteral(this.value);
    case types$1._null:
    case types$1._true:
    case types$1._false:
      node = this.startNode();
      node.value = this.type === types$1._null ? null : this.type === types$1._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");
    case types$1.parenL:
      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
      if (refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
          refDestructuringErrors.parenthesizedAssign = start;
        }
        if (refDestructuringErrors.parenthesizedBind < 0) {
          refDestructuringErrors.parenthesizedBind = start;
        }
      }
      return expr;
    case types$1.bracketL:
      node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
      return this.finishNode(node, "ArrayExpression");
    case types$1.braceL:
      this.overrideContext(types.b_expr);
      return this.parseObj(false, refDestructuringErrors);
    case types$1._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, 0);
    case types$1._class:
      return this.parseClass(this.startNode(), false);
    case types$1._new:
      return this.parseNew();
    case types$1.backQuote:
      return this.parseTemplate();
    case types$1._import:
      if (this.options.ecmaVersion >= 11) {
        return this.parseExprImport(forNew);
      } else {
        return this.unexpected();
      }
    default:
      return this.parseExprAtomDefault();
  }
};
pp$5.parseExprAtomDefault = function() {
  this.unexpected();
};
pp$5.parseExprImport = function(forNew) {
  var node = this.startNode();
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword import");
  }
  this.next();
  if (this.type === types$1.parenL && !forNew) {
    return this.parseDynamicImport(node);
  } else if (this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "import";
    node.meta = this.finishNode(meta, "Identifier");
    return this.parseImportMeta(node);
  } else {
    this.unexpected();
  }
};
pp$5.parseDynamicImport = function(node) {
  this.next();
  node.source = this.parseMaybeAssign();
  if (this.options.ecmaVersion >= 16) {
    if (!this.eat(types$1.parenR)) {
      this.expect(types$1.comma);
      if (!this.afterTrailingComma(types$1.parenR)) {
        node.options = this.parseMaybeAssign();
        if (!this.eat(types$1.parenR)) {
          this.expect(types$1.comma);
          if (!this.afterTrailingComma(types$1.parenR)) {
            this.unexpected();
          }
        }
      } else {
        node.options = null;
      }
    } else {
      node.options = null;
    }
  } else {
    if (!this.eat(types$1.parenR)) {
      var errorPos = this.start;
      if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
        this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
      } else {
        this.unexpected(errorPos);
      }
    }
  }
  return this.finishNode(node, "ImportExpression");
};
pp$5.parseImportMeta = function(node) {
  this.next();
  var containsEsc = this.containsEsc;
  node.property = this.parseIdent(true);
  if (node.property.name !== "meta") {
    this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
  }
  if (containsEsc) {
    this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
  }
  if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere) {
    this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
  }
  return this.finishNode(node, "MetaProperty");
};
pp$5.parseLiteral = function(value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
    node.bigint = node.value != null ? node.value.toString() : node.raw.slice(0, -1).replace(/_/g, "");
  }
  this.next();
  return this.finishNode(node, "Literal");
};
pp$5.parseParenExpression = function() {
  this.expect(types$1.parenL);
  var val = this.parseExpression();
  this.expect(types$1.parenR);
  return val;
};
pp$5.shouldParseArrow = function(exprList) {
  return !this.canInsertSemicolon();
};
pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();
    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    var exprList = [], first = true, lastIsComma = false;
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    this.yieldPos = 0;
    this.awaitPos = 0;
    while (this.type !== types$1.parenR) {
      first ? first = false : this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
        lastIsComma = true;
        break;
      } else if (this.type === types$1.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRestBinding()));
        if (this.type === types$1.comma) {
          this.raiseRecoverable(
            this.start,
            "Comma is not permitted after the rest element"
          );
        }
        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
      }
    }
    var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
    this.expect(types$1.parenR);
    if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(types$1.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      return this.parseParenArrowList(startPos, startLoc, exprList, forInit);
    }
    if (!exprList.length || lastIsComma) {
      this.unexpected(this.lastTokStart);
    }
    if (spreadStart) {
      this.unexpected(spreadStart);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }
  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};
pp$5.parseParenItem = function(item) {
  return item;
};
pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit);
};
var empty = [];
pp$5.parseNew = function() {
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword new");
  }
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion >= 6 && this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "new";
    node.meta = this.finishNode(meta, "Identifier");
    this.next();
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") {
      this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
    }
    if (containsEsc) {
      this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
    }
    if (!this.allowNewDotTarget) {
      this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block");
    }
    return this.finishNode(node, "MetaProperty");
  }
  var startPos = this.start, startLoc = this.startLoc;
  node.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), startPos, startLoc, true, false);
  if (node.callee.type === "Super") {
    this.raiseRecoverable(startPos, "Invalid use of 'super'");
  }
  if (this.eat(types$1.parenL)) {
    node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false);
  } else {
    node.arguments = empty;
  }
  return this.finishNode(node, "NewExpression");
};
pp$5.parseTemplateElement = function(ref2) {
  var isTagged = ref2.isTagged;
  var elem = this.startNode();
  if (this.type === types$1.invalidTemplate) {
    if (!isTagged) {
      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    }
    elem.value = {
      raw: this.value.replace(/\r\n?/g, "\n"),
      cooked: null
    };
  } else {
    elem.value = {
      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
      cooked: this.value
    };
  }
  this.next();
  elem.tail = this.type === types$1.backQuote;
  return this.finishNode(elem, "TemplateElement");
};
pp$5.parseTemplate = function(ref2) {
  if (ref2 === void 0) ref2 = {};
  var isTagged = ref2.isTagged;
  if (isTagged === void 0) isTagged = false;
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement({ isTagged });
  node.quasis = [curElt];
  while (!curElt.tail) {
    if (this.type === types$1.eof) {
      this.raise(this.pos, "Unterminated template literal");
    }
    this.expect(types$1.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(types$1.braceR);
    node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral");
};
pp$5.isAsyncProp = function(prop) {
  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types$1.star) && !lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$5.parseObj = function(isPattern, refDestructuringErrors) {
  var node = this.startNode(), first = true, propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    if (!isPattern) {
      this.checkPropClash(prop, propHash, refDestructuringErrors);
    }
    node.properties.push(prop);
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};
pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
  if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
    if (isPattern) {
      prop.argument = this.parseIdent(false);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      return this.finishNode(prop, "RestElement");
    }
    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
      refDestructuringErrors.trailingComma = this.start;
    }
    return this.finishNode(prop, "SpreadElement");
  }
  if (this.options.ecmaVersion >= 6) {
    prop.method = false;
    prop.shorthand = false;
    if (isPattern || refDestructuringErrors) {
      startPos = this.start;
      startLoc = this.startLoc;
    }
    if (!isPattern) {
      isGenerator = this.eat(types$1.star);
    }
  }
  var containsEsc = this.containsEsc;
  this.parsePropertyName(prop);
  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    isAsync = true;
    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
    this.parsePropertyName(prop);
  } else {
    isAsync = false;
  }
  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
  return this.finishNode(prop, "Property");
};
pp$5.parseGetterSetter = function(prop) {
  var kind = prop.key.name;
  this.parsePropertyName(prop);
  prop.value = this.parseMethod(false);
  prop.kind = kind;
  var paramCount = prop.kind === "get" ? 0 : 1;
  if (prop.value.params.length !== paramCount) {
    var start = prop.value.start;
    if (prop.kind === "get") {
      this.raiseRecoverable(start, "getter should have no params");
    } else {
      this.raiseRecoverable(start, "setter should have exactly one param");
    }
  } else {
    if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
      this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
    }
  }
};
pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
  if ((isGenerator || isAsync) && this.type === types$1.colon) {
    this.unexpected();
  }
  if (this.eat(types$1.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
    if (isPattern) {
      this.unexpected();
    }
    prop.method = true;
    prop.value = this.parseMethod(isGenerator, isAsync);
    prop.kind = "init";
  } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.parseGetterSetter(prop);
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.checkUnreserved(prop.key);
    if (prop.key.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = startPos;
    }
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else if (this.type === types$1.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0) {
        refDestructuringErrors.shorthandAssign = this.start;
      }
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else {
      prop.value = this.copyNode(prop.key);
    }
    prop.kind = "init";
    prop.shorthand = true;
  } else {
    this.unexpected();
  }
};
pp$5.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(types$1.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types$1.bracketR);
      return prop.key;
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
};
pp$5.initFunction = function(node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) {
    node.generator = node.expression = false;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = false;
  }
};
pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
  this.parseFunctionBody(node, false, true, false);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "FunctionExpression");
};
pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
  this.initFunction(node);
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "ArrowFunctionExpression");
};
pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
  var isExpression = isArrowFunction && this.type !== types$1.braceL;
  var oldStrict = this.strict, useStrict = false;
  if (isExpression) {
    node.body = this.parseMaybeAssign(forInit);
    node.expression = true;
    this.checkParams(node, false);
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end);
      if (useStrict && nonSimple) {
        this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
      }
    }
    var oldLabels = this.labels;
    this.labels = [];
    if (useStrict) {
      this.strict = true;
    }
    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    if (this.strict && node.id) {
      this.checkLValSimple(node.id, BIND_OUTSIDE);
    }
    node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
    node.expression = false;
    this.adaptDirectivePrologue(node.body.body);
    this.labels = oldLabels;
  }
  this.exitScope();
};
pp$5.isSimpleParamList = function(params) {
  for (var i2 = 0, list2 = params; i2 < list2.length; i2 += 1) {
    var param = list2[i2];
    if (param.type !== "Identifier") {
      return false;
    }
  }
  return true;
};
pp$5.checkParams = function(node, allowDuplicates) {
  var nameHash = /* @__PURE__ */ Object.create(null);
  for (var i2 = 0, list2 = node.params; i2 < list2.length; i2 += 1) {
    var param = list2[i2];
    this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
  }
};
pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (!first) {
      this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) {
        break;
      }
    } else {
      first = false;
    }
    var elt = void 0;
    if (allowEmpty && this.type === types$1.comma) {
      elt = null;
    } else if (this.type === types$1.ellipsis) {
      elt = this.parseSpread(refDestructuringErrors);
      if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
    } else {
      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    }
    elts.push(elt);
  }
  return elts;
};
pp$5.checkUnreserved = function(ref2) {
  var start = ref2.start;
  var end = ref2.end;
  var name = ref2.name;
  if (this.inGenerator && name === "yield") {
    this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
  }
  if (this.inAsync && name === "await") {
    this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
  }
  if (!(this.currentThisScope().flags & SCOPE_VAR) && name === "arguments") {
    this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer");
  }
  if (this.inClassStaticBlock && (name === "arguments" || name === "await")) {
    this.raise(start, "Cannot use " + name + " in class static initialization block");
  }
  if (this.keywords.test(name)) {
    this.raise(start, "Unexpected keyword '" + name + "'");
  }
  if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
    return;
  }
  var re3 = this.strict ? this.reservedWordsStrict : this.reservedWords;
  if (re3.test(name)) {
    if (!this.inAsync && name === "await") {
      this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
    }
    this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
  }
};
pp$5.parseIdent = function(liberal) {
  var node = this.parseIdentNode();
  this.next(!!liberal);
  this.finishNode(node, "Identifier");
  if (!liberal) {
    this.checkUnreserved(node);
    if (node.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = node.start;
    }
  }
  return node;
};
pp$5.parseIdentNode = function() {
  var node = this.startNode();
  if (this.type === types$1.name) {
    node.name = this.value;
  } else if (this.type.keyword) {
    node.name = this.type.keyword;
    if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop();
    }
    this.type = types$1.name;
  } else {
    this.unexpected();
  }
  return node;
};
pp$5.parsePrivateIdent = function() {
  var node = this.startNode();
  if (this.type === types$1.privateId) {
    node.name = this.value;
  } else {
    this.unexpected();
  }
  this.next();
  this.finishNode(node, "PrivateIdentifier");
  if (this.options.checkPrivateFields) {
    if (this.privateNameStack.length === 0) {
      this.raise(node.start, "Private field '#" + node.name + "' must be declared in an enclosing class");
    } else {
      this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
    }
  }
  return node;
};
pp$5.parseYield = function(forInit) {
  if (!this.yieldPos) {
    this.yieldPos = this.start;
  }
  var node = this.startNode();
  this.next();
  if (this.type === types$1.semi || this.canInsertSemicolon() || this.type !== types$1.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(types$1.star);
    node.argument = this.parseMaybeAssign(forInit);
  }
  return this.finishNode(node, "YieldExpression");
};
pp$5.parseAwait = function(forInit) {
  if (!this.awaitPos) {
    this.awaitPos = this.start;
  }
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeUnary(null, true, false, forInit);
  return this.finishNode(node, "AwaitExpression");
};
var pp$4 = Parser.prototype;
pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  if (this.sourceFile) {
    message += " in " + this.sourceFile;
  }
  var err = new SyntaxError(message);
  err.pos = pos;
  err.loc = loc;
  err.raisedAt = this.pos;
  throw err;
};
pp$4.raiseRecoverable = pp$4.raise;
pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart);
  }
};
var pp$3 = Parser.prototype;
var Scope = function Scope2(flags) {
  this.flags = flags;
  this.var = [];
  this.lexical = [];
  this.functions = [];
};
pp$3.enterScope = function(flags) {
  this.scopeStack.push(new Scope(flags));
};
pp$3.exitScope = function() {
  this.scopeStack.pop();
};
pp$3.treatFunctionsAsVarInScope = function(scope) {
  return scope.flags & SCOPE_FUNCTION || !this.inModule && scope.flags & SCOPE_TOP;
};
pp$3.declareName = function(name, bindingType, pos) {
  var redeclared = false;
  if (bindingType === BIND_LEXICAL) {
    var scope = this.currentScope();
    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    scope.lexical.push(name);
    if (this.inModule && scope.flags & SCOPE_TOP) {
      delete this.undefinedExports[name];
    }
  } else if (bindingType === BIND_SIMPLE_CATCH) {
    var scope$1 = this.currentScope();
    scope$1.lexical.push(name);
  } else if (bindingType === BIND_FUNCTION) {
    var scope$2 = this.currentScope();
    if (this.treatFunctionsAsVar) {
      redeclared = scope$2.lexical.indexOf(name) > -1;
    } else {
      redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
    }
    scope$2.functions.push(name);
  } else {
    for (var i2 = this.scopeStack.length - 1; i2 >= 0; --i2) {
      var scope$3 = this.scopeStack[i2];
      if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
        redeclared = true;
        break;
      }
      scope$3.var.push(name);
      if (this.inModule && scope$3.flags & SCOPE_TOP) {
        delete this.undefinedExports[name];
      }
      if (scope$3.flags & SCOPE_VAR) {
        break;
      }
    }
  }
  if (redeclared) {
    this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
  }
};
pp$3.checkLocalExport = function(id2) {
  if (this.scopeStack[0].lexical.indexOf(id2.name) === -1 && this.scopeStack[0].var.indexOf(id2.name) === -1) {
    this.undefinedExports[id2.name] = id2;
  }
};
pp$3.currentScope = function() {
  return this.scopeStack[this.scopeStack.length - 1];
};
pp$3.currentVarScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK)) {
      return scope;
    }
  }
};
pp$3.currentThisScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) && !(scope.flags & SCOPE_ARROW)) {
      return scope;
    }
  }
};
var Node = function Node2(parser, pos, loc) {
  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser.options.locations) {
    this.loc = new SourceLocation(parser, loc);
  }
  if (parser.options.directSourceFile) {
    this.sourceFile = parser.options.directSourceFile;
  }
  if (parser.options.ranges) {
    this.range = [pos, 0];
  }
};
var pp$2 = Parser.prototype;
pp$2.startNode = function() {
  return new Node(this, this.start, this.startLoc);
};
pp$2.startNodeAt = function(pos, loc) {
  return new Node(this, pos, loc);
};
function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations) {
    node.loc.end = loc;
  }
  if (this.options.ranges) {
    node.range[1] = pos;
  }
  return node;
}
pp$2.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
};
pp$2.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc);
};
pp$2.copyNode = function(node) {
  var newNode = new Node(this, node.start, this.startLoc);
  for (var prop in node) {
    newNode[prop] = node[prop];
  }
  return newNode;
};
var scriptValuesAddedInUnicode = "Berf Beria_Erfe Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sidetic Sidt Sunu Sunuwar Tai_Yo Tayo Todhri Todr Tolong_Siki Tols Tulu_Tigalari Tutg Unknown Zzzz";
var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
var ecma11BinaryProperties = ecma10BinaryProperties;
var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
var ecma13BinaryProperties = ecma12BinaryProperties;
var ecma14BinaryProperties = ecma13BinaryProperties;
var unicodeBinaryProperties = {
  9: ecma9BinaryProperties,
  10: ecma10BinaryProperties,
  11: ecma11BinaryProperties,
  12: ecma12BinaryProperties,
  13: ecma13BinaryProperties,
  14: ecma14BinaryProperties
};
var ecma14BinaryPropertiesOfStrings = "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji";
var unicodeBinaryPropertiesOfStrings = {
  9: "",
  10: "",
  11: "",
  12: "",
  13: "",
  14: ecma14BinaryPropertiesOfStrings
};
var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
var ecma14ScriptValues = ecma13ScriptValues + " " + scriptValuesAddedInUnicode;
var unicodeScriptValues = {
  9: ecma9ScriptValues,
  10: ecma10ScriptValues,
  11: ecma11ScriptValues,
  12: ecma12ScriptValues,
  13: ecma13ScriptValues,
  14: ecma14ScriptValues
};
var data = {};
function buildUnicodeData(ecmaVersion2) {
  var d2 = data[ecmaVersion2] = {
    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion2] + " " + unicodeGeneralCategoryValues),
    binaryOfStrings: wordsRegexp(unicodeBinaryPropertiesOfStrings[ecmaVersion2]),
    nonBinary: {
      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
      Script: wordsRegexp(unicodeScriptValues[ecmaVersion2])
    }
  };
  d2.nonBinary.Script_Extensions = d2.nonBinary.Script;
  d2.nonBinary.gc = d2.nonBinary.General_Category;
  d2.nonBinary.sc = d2.nonBinary.Script;
  d2.nonBinary.scx = d2.nonBinary.Script_Extensions;
}
for (i = 0, list = [9, 10, 11, 12, 13, 14]; i < list.length; i += 1) {
  ecmaVersion = list[i];
  buildUnicodeData(ecmaVersion);
}
var ecmaVersion;
var i;
var list;
var pp$1 = Parser.prototype;
var BranchID = function BranchID2(parent, base) {
  this.parent = parent;
  this.base = base || this;
};
BranchID.prototype.separatedFrom = function separatedFrom(alt) {
  for (var self = this; self; self = self.parent) {
    for (var other = alt; other; other = other.parent) {
      if (self.base === other.base && self !== other) {
        return true;
      }
    }
  }
  return false;
};
BranchID.prototype.sibling = function sibling() {
  return new BranchID(this.parent, this.base);
};
var RegExpValidationState = function RegExpValidationState2(parser) {
  this.parser = parser;
  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "") + (parser.options.ecmaVersion >= 15 ? "v" : "");
  this.unicodeProperties = data[parser.options.ecmaVersion >= 14 ? 14 : parser.options.ecmaVersion];
  this.source = "";
  this.flags = "";
  this.start = 0;
  this.switchU = false;
  this.switchV = false;
  this.switchN = false;
  this.pos = 0;
  this.lastIntValue = 0;
  this.lastStringValue = "";
  this.lastAssertionIsQuantifiable = false;
  this.numCapturingParens = 0;
  this.maxBackReference = 0;
  this.groupNames = /* @__PURE__ */ Object.create(null);
  this.backReferenceNames = [];
  this.branchID = null;
};
RegExpValidationState.prototype.reset = function reset(start, pattern2, flags) {
  var unicodeSets = flags.indexOf("v") !== -1;
  var unicode = flags.indexOf("u") !== -1;
  this.start = start | 0;
  this.source = pattern2 + "";
  this.flags = flags;
  if (unicodeSets && this.parser.options.ecmaVersion >= 15) {
    this.switchU = true;
    this.switchV = true;
    this.switchN = true;
  } else {
    this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
    this.switchV = false;
    this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
  }
};
RegExpValidationState.prototype.raise = function raise(message) {
  this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
};
RegExpValidationState.prototype.at = function at2(i2, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l2 = s.length;
  if (i2 >= l2) {
    return -1;
  }
  var c2 = s.charCodeAt(i2);
  if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2) {
    return c2;
  }
  var next = s.charCodeAt(i2 + 1);
  return next >= 56320 && next <= 57343 ? (c2 << 10) + next - 56613888 : c2;
};
RegExpValidationState.prototype.nextIndex = function nextIndex(i2, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l2 = s.length;
  if (i2 >= l2) {
    return l2;
  }
  var c2 = s.charCodeAt(i2), next;
  if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2 || (next = s.charCodeAt(i2 + 1)) < 56320 || next > 57343) {
    return i2 + 1;
  }
  return i2 + 2;
};
RegExpValidationState.prototype.current = function current(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.pos, forceU);
};
RegExpValidationState.prototype.lookahead = function lookahead(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.nextIndex(this.pos, forceU), forceU);
};
RegExpValidationState.prototype.advance = function advance(forceU) {
  if (forceU === void 0) forceU = false;
  this.pos = this.nextIndex(this.pos, forceU);
};
RegExpValidationState.prototype.eat = function eat(ch2, forceU) {
  if (forceU === void 0) forceU = false;
  if (this.current(forceU) === ch2) {
    this.advance(forceU);
    return true;
  }
  return false;
};
RegExpValidationState.prototype.eatChars = function eatChars(chs, forceU) {
  if (forceU === void 0) forceU = false;
  var pos = this.pos;
  for (var i2 = 0, list2 = chs; i2 < list2.length; i2 += 1) {
    var ch2 = list2[i2];
    var current2 = this.at(pos, forceU);
    if (current2 === -1 || current2 !== ch2) {
      return false;
    }
    pos = this.nextIndex(pos, forceU);
  }
  this.pos = pos;
  return true;
};
pp$1.validateRegExpFlags = function(state) {
  var validFlags = state.validFlags;
  var flags = state.flags;
  var u = false;
  var v = false;
  for (var i2 = 0; i2 < flags.length; i2++) {
    var flag = flags.charAt(i2);
    if (validFlags.indexOf(flag) === -1) {
      this.raise(state.start, "Invalid regular expression flag");
    }
    if (flags.indexOf(flag, i2 + 1) > -1) {
      this.raise(state.start, "Duplicate regular expression flag");
    }
    if (flag === "u") {
      u = true;
    }
    if (flag === "v") {
      v = true;
    }
  }
  if (this.options.ecmaVersion >= 15 && u && v) {
    this.raise(state.start, "Invalid regular expression flag");
  }
};
function hasProp(obj) {
  for (var _2 in obj) {
    return true;
  }
  return false;
}
pp$1.validateRegExpPattern = function(state) {
  this.regexp_pattern(state);
  if (!state.switchN && this.options.ecmaVersion >= 9 && hasProp(state.groupNames)) {
    state.switchN = true;
    this.regexp_pattern(state);
  }
};
pp$1.regexp_pattern = function(state) {
  state.pos = 0;
  state.lastIntValue = 0;
  state.lastStringValue = "";
  state.lastAssertionIsQuantifiable = false;
  state.numCapturingParens = 0;
  state.maxBackReference = 0;
  state.groupNames = /* @__PURE__ */ Object.create(null);
  state.backReferenceNames.length = 0;
  state.branchID = null;
  this.regexp_disjunction(state);
  if (state.pos !== state.source.length) {
    if (state.eat(
      41
      /* ) */
    )) {
      state.raise("Unmatched ')'");
    }
    if (state.eat(
      93
      /* ] */
    ) || state.eat(
      125
      /* } */
    )) {
      state.raise("Lone quantifier brackets");
    }
  }
  if (state.maxBackReference > state.numCapturingParens) {
    state.raise("Invalid escape");
  }
  for (var i2 = 0, list2 = state.backReferenceNames; i2 < list2.length; i2 += 1) {
    var name = list2[i2];
    if (!state.groupNames[name]) {
      state.raise("Invalid named capture referenced");
    }
  }
};
pp$1.regexp_disjunction = function(state) {
  var trackDisjunction = this.options.ecmaVersion >= 16;
  if (trackDisjunction) {
    state.branchID = new BranchID(state.branchID, null);
  }
  this.regexp_alternative(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (trackDisjunction) {
      state.branchID = state.branchID.sibling();
    }
    this.regexp_alternative(state);
  }
  if (trackDisjunction) {
    state.branchID = state.branchID.parent;
  }
  if (this.regexp_eatQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  if (state.eat(
    123
    /* { */
  )) {
    state.raise("Lone quantifier brackets");
  }
};
pp$1.regexp_alternative = function(state) {
  while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
  }
};
pp$1.regexp_eatTerm = function(state) {
  if (this.regexp_eatAssertion(state)) {
    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
      if (state.switchU) {
        state.raise("Invalid quantifier");
      }
    }
    return true;
  }
  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    this.regexp_eatQuantifier(state);
    return true;
  }
  return false;
};
pp$1.regexp_eatAssertion = function(state) {
  var start = state.pos;
  state.lastAssertionIsQuantifiable = false;
  if (state.eat(
    94
    /* ^ */
  ) || state.eat(
    36
    /* $ */
  )) {
    return true;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    if (state.eat(
      66
      /* B */
    ) || state.eat(
      98
      /* b */
    )) {
      return true;
    }
    state.pos = start;
  }
  if (state.eat(
    40
    /* ( */
  ) && state.eat(
    63
    /* ? */
  )) {
    var lookbehind = false;
    if (this.options.ecmaVersion >= 9) {
      lookbehind = state.eat(
        60
        /* < */
      );
    }
    if (state.eat(
      61
      /* = */
    ) || state.eat(
      33
      /* ! */
    )) {
      this.regexp_disjunction(state);
      if (!state.eat(
        41
        /* ) */
      )) {
        state.raise("Unterminated group");
      }
      state.lastAssertionIsQuantifiable = !lookbehind;
      return true;
    }
  }
  state.pos = start;
  return false;
};
pp$1.regexp_eatQuantifier = function(state, noError) {
  if (noError === void 0) noError = false;
  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    state.eat(
      63
      /* ? */
    );
    return true;
  }
  return false;
};
pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
  return state.eat(
    42
    /* * */
  ) || state.eat(
    43
    /* + */
  ) || state.eat(
    63
    /* ? */
  ) || this.regexp_eatBracedQuantifier(state, noError);
};
pp$1.regexp_eatBracedQuantifier = function(state, noError) {
  var start = state.pos;
  if (state.eat(
    123
    /* { */
  )) {
    var min = 0, max = -1;
    if (this.regexp_eatDecimalDigits(state)) {
      min = state.lastIntValue;
      if (state.eat(
        44
        /* , */
      ) && this.regexp_eatDecimalDigits(state)) {
        max = state.lastIntValue;
      }
      if (state.eat(
        125
        /* } */
      )) {
        if (max !== -1 && max < min && !noError) {
          state.raise("numbers out of order in {} quantifier");
        }
        return true;
      }
    }
    if (state.switchU && !noError) {
      state.raise("Incomplete quantifier");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatAtom = function(state) {
  return this.regexp_eatPatternCharacters(state) || state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
};
pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatAtomEscape(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatUncapturingGroup = function(state) {
  var start = state.pos;
  if (state.eat(
    40
    /* ( */
  )) {
    if (state.eat(
      63
      /* ? */
    )) {
      if (this.options.ecmaVersion >= 16) {
        var addModifiers = this.regexp_eatModifiers(state);
        var hasHyphen = state.eat(
          45
          /* - */
        );
        if (addModifiers || hasHyphen) {
          for (var i2 = 0; i2 < addModifiers.length; i2++) {
            var modifier = addModifiers.charAt(i2);
            if (addModifiers.indexOf(modifier, i2 + 1) > -1) {
              state.raise("Duplicate regular expression modifiers");
            }
          }
          if (hasHyphen) {
            var removeModifiers = this.regexp_eatModifiers(state);
            if (!addModifiers && !removeModifiers && state.current() === 58) {
              state.raise("Invalid regular expression modifiers");
            }
            for (var i$1 = 0; i$1 < removeModifiers.length; i$1++) {
              var modifier$1 = removeModifiers.charAt(i$1);
              if (removeModifiers.indexOf(modifier$1, i$1 + 1) > -1 || addModifiers.indexOf(modifier$1) > -1) {
                state.raise("Duplicate regular expression modifiers");
              }
            }
          }
        }
      }
      if (state.eat(
        58
        /* : */
      )) {
        this.regexp_disjunction(state);
        if (state.eat(
          41
          /* ) */
        )) {
          return true;
        }
        state.raise("Unterminated group");
      }
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatCapturingGroup = function(state) {
  if (state.eat(
    40
    /* ( */
  )) {
    if (this.options.ecmaVersion >= 9) {
      this.regexp_groupSpecifier(state);
    } else if (state.current() === 63) {
      state.raise("Invalid group");
    }
    this.regexp_disjunction(state);
    if (state.eat(
      41
      /* ) */
    )) {
      state.numCapturingParens += 1;
      return true;
    }
    state.raise("Unterminated group");
  }
  return false;
};
pp$1.regexp_eatModifiers = function(state) {
  var modifiers = "";
  var ch2 = 0;
  while ((ch2 = state.current()) !== -1 && isRegularExpressionModifier(ch2)) {
    modifiers += codePointToString(ch2);
    state.advance();
  }
  return modifiers;
};
function isRegularExpressionModifier(ch2) {
  return ch2 === 105 || ch2 === 109 || ch2 === 115;
}
pp$1.regexp_eatExtendedAtom = function(state) {
  return state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
};
pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
  if (this.regexp_eatBracedQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  return false;
};
pp$1.regexp_eatSyntaxCharacter = function(state) {
  var ch2 = state.current();
  if (isSyntaxCharacter(ch2)) {
    state.lastIntValue = ch2;
    state.advance();
    return true;
  }
  return false;
};
function isSyntaxCharacter(ch2) {
  return ch2 === 36 || ch2 >= 40 && ch2 <= 43 || ch2 === 46 || ch2 === 63 || ch2 >= 91 && ch2 <= 94 || ch2 >= 123 && ch2 <= 125;
}
pp$1.regexp_eatPatternCharacters = function(state) {
  var start = state.pos;
  var ch2 = 0;
  while ((ch2 = state.current()) !== -1 && !isSyntaxCharacter(ch2)) {
    state.advance();
  }
  return state.pos !== start;
};
pp$1.regexp_eatExtendedPatternCharacter = function(state) {
  var ch2 = state.current();
  if (ch2 !== -1 && ch2 !== 36 && !(ch2 >= 40 && ch2 <= 43) && ch2 !== 46 && ch2 !== 63 && ch2 !== 91 && ch2 !== 94 && ch2 !== 124) {
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_groupSpecifier = function(state) {
  if (state.eat(
    63
    /* ? */
  )) {
    if (!this.regexp_eatGroupName(state)) {
      state.raise("Invalid group");
    }
    var trackDisjunction = this.options.ecmaVersion >= 16;
    var known = state.groupNames[state.lastStringValue];
    if (known) {
      if (trackDisjunction) {
        for (var i2 = 0, list2 = known; i2 < list2.length; i2 += 1) {
          var altID = list2[i2];
          if (!altID.separatedFrom(state.branchID)) {
            state.raise("Duplicate capture group name");
          }
        }
      } else {
        state.raise("Duplicate capture group name");
      }
    }
    if (trackDisjunction) {
      (known || (state.groupNames[state.lastStringValue] = [])).push(state.branchID);
    } else {
      state.groupNames[state.lastStringValue] = true;
    }
  }
};
pp$1.regexp_eatGroupName = function(state) {
  state.lastStringValue = "";
  if (state.eat(
    60
    /* < */
  )) {
    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(
      62
      /* > */
    )) {
      return true;
    }
    state.raise("Invalid capture group name");
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierName = function(state) {
  state.lastStringValue = "";
  if (this.regexp_eatRegExpIdentifierStart(state)) {
    state.lastStringValue += codePointToString(state.lastIntValue);
    while (this.regexp_eatRegExpIdentifierPart(state)) {
      state.lastStringValue += codePointToString(state.lastIntValue);
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierStart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch2 = state.current(forceU);
  state.advance(forceU);
  if (ch2 === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch2 = state.lastIntValue;
  }
  if (isRegExpIdentifierStart(ch2)) {
    state.lastIntValue = ch2;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierStart(ch2) {
  return isIdentifierStart(ch2, true) || ch2 === 36 || ch2 === 95;
}
pp$1.regexp_eatRegExpIdentifierPart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch2 = state.current(forceU);
  state.advance(forceU);
  if (ch2 === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch2 = state.lastIntValue;
  }
  if (isRegExpIdentifierPart(ch2)) {
    state.lastIntValue = ch2;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierPart(ch2) {
  return isIdentifierChar(ch2, true) || ch2 === 36 || ch2 === 95 || ch2 === 8204 || ch2 === 8205;
}
pp$1.regexp_eatAtomEscape = function(state) {
  if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
    return true;
  }
  if (state.switchU) {
    if (state.current() === 99) {
      state.raise("Invalid unicode escape");
    }
    state.raise("Invalid escape");
  }
  return false;
};
pp$1.regexp_eatBackReference = function(state) {
  var start = state.pos;
  if (this.regexp_eatDecimalEscape(state)) {
    var n = state.lastIntValue;
    if (state.switchU) {
      if (n > state.maxBackReference) {
        state.maxBackReference = n;
      }
      return true;
    }
    if (n <= state.numCapturingParens) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatKGroupName = function(state) {
  if (state.eat(
    107
    /* k */
  )) {
    if (this.regexp_eatGroupName(state)) {
      state.backReferenceNames.push(state.lastStringValue);
      return true;
    }
    state.raise("Invalid named reference");
  }
  return false;
};
pp$1.regexp_eatCharacterEscape = function(state) {
  return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
};
pp$1.regexp_eatCControlLetter = function(state) {
  var start = state.pos;
  if (state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatZero = function(state) {
  if (state.current() === 48 && !isDecimalDigit(state.lookahead())) {
    state.lastIntValue = 0;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlEscape = function(state) {
  var ch2 = state.current();
  if (ch2 === 116) {
    state.lastIntValue = 9;
    state.advance();
    return true;
  }
  if (ch2 === 110) {
    state.lastIntValue = 10;
    state.advance();
    return true;
  }
  if (ch2 === 118) {
    state.lastIntValue = 11;
    state.advance();
    return true;
  }
  if (ch2 === 102) {
    state.lastIntValue = 12;
    state.advance();
    return true;
  }
  if (ch2 === 114) {
    state.lastIntValue = 13;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlLetter = function(state) {
  var ch2 = state.current();
  if (isControlLetter(ch2)) {
    state.lastIntValue = ch2 % 32;
    state.advance();
    return true;
  }
  return false;
};
function isControlLetter(ch2) {
  return ch2 >= 65 && ch2 <= 90 || ch2 >= 97 && ch2 <= 122;
}
pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
  if (forceU === void 0) forceU = false;
  var start = state.pos;
  var switchU = forceU || state.switchU;
  if (state.eat(
    117
    /* u */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 4)) {
      var lead = state.lastIntValue;
      if (switchU && lead >= 55296 && lead <= 56319) {
        var leadSurrogateEnd = state.pos;
        if (state.eat(
          92
          /* \ */
        ) && state.eat(
          117
          /* u */
        ) && this.regexp_eatFixedHexDigits(state, 4)) {
          var trail = state.lastIntValue;
          if (trail >= 56320 && trail <= 57343) {
            state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
            return true;
          }
        }
        state.pos = leadSurrogateEnd;
        state.lastIntValue = lead;
      }
      return true;
    }
    if (switchU && state.eat(
      123
      /* { */
    ) && this.regexp_eatHexDigits(state) && state.eat(
      125
      /* } */
    ) && isValidUnicode(state.lastIntValue)) {
      return true;
    }
    if (switchU) {
      state.raise("Invalid unicode escape");
    }
    state.pos = start;
  }
  return false;
};
function isValidUnicode(ch2) {
  return ch2 >= 0 && ch2 <= 1114111;
}
pp$1.regexp_eatIdentityEscape = function(state) {
  if (state.switchU) {
    if (this.regexp_eatSyntaxCharacter(state)) {
      return true;
    }
    if (state.eat(
      47
      /* / */
    )) {
      state.lastIntValue = 47;
      return true;
    }
    return false;
  }
  var ch2 = state.current();
  if (ch2 !== 99 && (!state.switchN || ch2 !== 107)) {
    state.lastIntValue = ch2;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatDecimalEscape = function(state) {
  state.lastIntValue = 0;
  var ch2 = state.current();
  if (ch2 >= 49 && ch2 <= 57) {
    do {
      state.lastIntValue = 10 * state.lastIntValue + (ch2 - 48);
      state.advance();
    } while ((ch2 = state.current()) >= 48 && ch2 <= 57);
    return true;
  }
  return false;
};
var CharSetNone = 0;
var CharSetOk = 1;
var CharSetString = 2;
pp$1.regexp_eatCharacterClassEscape = function(state) {
  var ch2 = state.current();
  if (isCharacterClassEscape(ch2)) {
    state.lastIntValue = -1;
    state.advance();
    return CharSetOk;
  }
  var negate = false;
  if (state.switchU && this.options.ecmaVersion >= 9 && ((negate = ch2 === 80) || ch2 === 112)) {
    state.lastIntValue = -1;
    state.advance();
    var result;
    if (state.eat(
      123
      /* { */
    ) && (result = this.regexp_eatUnicodePropertyValueExpression(state)) && state.eat(
      125
      /* } */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Invalid property name");
      }
      return result;
    }
    state.raise("Invalid property name");
  }
  return CharSetNone;
};
function isCharacterClassEscape(ch2) {
  return ch2 === 100 || ch2 === 68 || ch2 === 115 || ch2 === 83 || ch2 === 119 || ch2 === 87;
}
pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
  var start = state.pos;
  if (this.regexp_eatUnicodePropertyName(state) && state.eat(
    61
    /* = */
  )) {
    var name = state.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(state)) {
      var value = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
      return CharSetOk;
    }
  }
  state.pos = start;
  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    var nameOrValue = state.lastStringValue;
    return this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
  }
  return CharSetNone;
};
pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
  if (!hasOwn(state.unicodeProperties.nonBinary, name)) {
    state.raise("Invalid property name");
  }
  if (!state.unicodeProperties.nonBinary[name].test(value)) {
    state.raise("Invalid property value");
  }
};
pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
  if (state.unicodeProperties.binary.test(nameOrValue)) {
    return CharSetOk;
  }
  if (state.switchV && state.unicodeProperties.binaryOfStrings.test(nameOrValue)) {
    return CharSetString;
  }
  state.raise("Invalid property name");
};
pp$1.regexp_eatUnicodePropertyName = function(state) {
  var ch2 = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyNameCharacter(ch2 = state.current())) {
    state.lastStringValue += codePointToString(ch2);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyNameCharacter(ch2) {
  return isControlLetter(ch2) || ch2 === 95;
}
pp$1.regexp_eatUnicodePropertyValue = function(state) {
  var ch2 = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyValueCharacter(ch2 = state.current())) {
    state.lastStringValue += codePointToString(ch2);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyValueCharacter(ch2) {
  return isUnicodePropertyNameCharacter(ch2) || isDecimalDigit(ch2);
}
pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
  return this.regexp_eatUnicodePropertyValue(state);
};
pp$1.regexp_eatCharacterClass = function(state) {
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (!state.eat(
      93
      /* ] */
    )) {
      state.raise("Unterminated character class");
    }
    if (negate && result === CharSetString) {
      state.raise("Negated character class may contain strings");
    }
    return true;
  }
  return false;
};
pp$1.regexp_classContents = function(state) {
  if (state.current() === 93) {
    return CharSetOk;
  }
  if (state.switchV) {
    return this.regexp_classSetExpression(state);
  }
  this.regexp_nonEmptyClassRanges(state);
  return CharSetOk;
};
pp$1.regexp_nonEmptyClassRanges = function(state) {
  while (this.regexp_eatClassAtom(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassAtom(state)) {
      var right = state.lastIntValue;
      if (state.switchU && (left === -1 || right === -1)) {
        state.raise("Invalid character class");
      }
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
    }
  }
};
pp$1.regexp_eatClassAtom = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatClassEscape(state)) {
      return true;
    }
    if (state.switchU) {
      var ch$1 = state.current();
      if (ch$1 === 99 || isOctalDigit(ch$1)) {
        state.raise("Invalid class escape");
      }
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  var ch2 = state.current();
  if (ch2 !== 93) {
    state.lastIntValue = ch2;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatClassEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    98
    /* b */
  )) {
    state.lastIntValue = 8;
    return true;
  }
  if (state.switchU && state.eat(
    45
    /* - */
  )) {
    state.lastIntValue = 45;
    return true;
  }
  if (!state.switchU && state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatClassControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
};
pp$1.regexp_classSetExpression = function(state) {
  var result = CharSetOk, subResult;
  if (this.regexp_eatClassSetRange(state)) ;
  else if (subResult = this.regexp_eatClassSetOperand(state)) {
    if (subResult === CharSetString) {
      result = CharSetString;
    }
    var start = state.pos;
    while (state.eatChars(
      [38, 38]
      /* && */
    )) {
      if (state.current() !== 38 && (subResult = this.regexp_eatClassSetOperand(state))) {
        if (subResult !== CharSetString) {
          result = CharSetOk;
        }
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
    while (state.eatChars(
      [45, 45]
      /* -- */
    )) {
      if (this.regexp_eatClassSetOperand(state)) {
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
  } else {
    state.raise("Invalid character in character class");
  }
  for (; ; ) {
    if (this.regexp_eatClassSetRange(state)) {
      continue;
    }
    subResult = this.regexp_eatClassSetOperand(state);
    if (!subResult) {
      return result;
    }
    if (subResult === CharSetString) {
      result = CharSetString;
    }
  }
};
pp$1.regexp_eatClassSetRange = function(state) {
  var start = state.pos;
  if (this.regexp_eatClassSetCharacter(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassSetCharacter(state)) {
      var right = state.lastIntValue;
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatClassSetOperand = function(state) {
  if (this.regexp_eatClassSetCharacter(state)) {
    return CharSetOk;
  }
  return this.regexp_eatClassStringDisjunction(state) || this.regexp_eatNestedClass(state);
};
pp$1.regexp_eatNestedClass = function(state) {
  var start = state.pos;
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (state.eat(
      93
      /* ] */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Negated character class may contain strings");
      }
      return result;
    }
    state.pos = start;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    var result$1 = this.regexp_eatCharacterClassEscape(state);
    if (result$1) {
      return result$1;
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_eatClassStringDisjunction = function(state) {
  var start = state.pos;
  if (state.eatChars(
    [92, 113]
    /* \q */
  )) {
    if (state.eat(
      123
      /* { */
    )) {
      var result = this.regexp_classStringDisjunctionContents(state);
      if (state.eat(
        125
        /* } */
      )) {
        return result;
      }
    } else {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_classStringDisjunctionContents = function(state) {
  var result = this.regexp_classString(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (this.regexp_classString(state) === CharSetString) {
      result = CharSetString;
    }
  }
  return result;
};
pp$1.regexp_classString = function(state) {
  var count = 0;
  while (this.regexp_eatClassSetCharacter(state)) {
    count++;
  }
  return count === 1 ? CharSetOk : CharSetString;
};
pp$1.regexp_eatClassSetCharacter = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatCharacterEscape(state) || this.regexp_eatClassSetReservedPunctuator(state)) {
      return true;
    }
    if (state.eat(
      98
      /* b */
    )) {
      state.lastIntValue = 8;
      return true;
    }
    state.pos = start;
    return false;
  }
  var ch2 = state.current();
  if (ch2 < 0 || ch2 === state.lookahead() && isClassSetReservedDoublePunctuatorCharacter(ch2)) {
    return false;
  }
  if (isClassSetSyntaxCharacter(ch2)) {
    return false;
  }
  state.advance();
  state.lastIntValue = ch2;
  return true;
};
function isClassSetReservedDoublePunctuatorCharacter(ch2) {
  return ch2 === 33 || ch2 >= 35 && ch2 <= 38 || ch2 >= 42 && ch2 <= 44 || ch2 === 46 || ch2 >= 58 && ch2 <= 64 || ch2 === 94 || ch2 === 96 || ch2 === 126;
}
function isClassSetSyntaxCharacter(ch2) {
  return ch2 === 40 || ch2 === 41 || ch2 === 45 || ch2 === 47 || ch2 >= 91 && ch2 <= 93 || ch2 >= 123 && ch2 <= 125;
}
pp$1.regexp_eatClassSetReservedPunctuator = function(state) {
  var ch2 = state.current();
  if (isClassSetReservedPunctuator(ch2)) {
    state.lastIntValue = ch2;
    state.advance();
    return true;
  }
  return false;
};
function isClassSetReservedPunctuator(ch2) {
  return ch2 === 33 || ch2 === 35 || ch2 === 37 || ch2 === 38 || ch2 === 44 || ch2 === 45 || ch2 >= 58 && ch2 <= 62 || ch2 === 64 || ch2 === 96 || ch2 === 126;
}
pp$1.regexp_eatClassControlLetter = function(state) {
  var ch2 = state.current();
  if (isDecimalDigit(ch2) || ch2 === 95) {
    state.lastIntValue = ch2 % 32;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatHexEscapeSequence = function(state) {
  var start = state.pos;
  if (state.eat(
    120
    /* x */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 2)) {
      return true;
    }
    if (state.switchU) {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatDecimalDigits = function(state) {
  var start = state.pos;
  var ch2 = 0;
  state.lastIntValue = 0;
  while (isDecimalDigit(ch2 = state.current())) {
    state.lastIntValue = 10 * state.lastIntValue + (ch2 - 48);
    state.advance();
  }
  return state.pos !== start;
};
function isDecimalDigit(ch2) {
  return ch2 >= 48 && ch2 <= 57;
}
pp$1.regexp_eatHexDigits = function(state) {
  var start = state.pos;
  var ch2 = 0;
  state.lastIntValue = 0;
  while (isHexDigit(ch2 = state.current())) {
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch2);
    state.advance();
  }
  return state.pos !== start;
};
function isHexDigit(ch2) {
  return ch2 >= 48 && ch2 <= 57 || ch2 >= 65 && ch2 <= 70 || ch2 >= 97 && ch2 <= 102;
}
function hexToInt(ch2) {
  if (ch2 >= 65 && ch2 <= 70) {
    return 10 + (ch2 - 65);
  }
  if (ch2 >= 97 && ch2 <= 102) {
    return 10 + (ch2 - 97);
  }
  return ch2 - 48;
}
pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
  if (this.regexp_eatOctalDigit(state)) {
    var n1 = state.lastIntValue;
    if (this.regexp_eatOctalDigit(state)) {
      var n2 = state.lastIntValue;
      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
      } else {
        state.lastIntValue = n1 * 8 + n2;
      }
    } else {
      state.lastIntValue = n1;
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatOctalDigit = function(state) {
  var ch2 = state.current();
  if (isOctalDigit(ch2)) {
    state.lastIntValue = ch2 - 48;
    state.advance();
    return true;
  }
  state.lastIntValue = 0;
  return false;
};
function isOctalDigit(ch2) {
  return ch2 >= 48 && ch2 <= 55;
}
pp$1.regexp_eatFixedHexDigits = function(state, length) {
  var start = state.pos;
  state.lastIntValue = 0;
  for (var i2 = 0; i2 < length; ++i2) {
    var ch2 = state.current();
    if (!isHexDigit(ch2)) {
      state.pos = start;
      return false;
    }
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch2);
    state.advance();
  }
  return true;
};
var Token = function Token2(p) {
  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations) {
    this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
  }
  if (p.options.ranges) {
    this.range = [p.start, p.end];
  }
};
var pp2 = Parser.prototype;
pp2.next = function(ignoreEscapeSequenceInKeyword) {
  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
  }
  if (this.options.onToken) {
    this.options.onToken(new Token(this));
  }
  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};
pp2.getToken = function() {
  this.next();
  return new Token(this);
};
if (typeof Symbol !== "undefined") {
  pp2[Symbol.iterator] = function() {
    var this$1$1 = this;
    return {
      next: function() {
        var token = this$1$1.getToken();
        return {
          done: token.type === types$1.eof,
          value: token
        };
      }
    };
  };
}
pp2.nextToken = function() {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) {
    this.skipSpace();
  }
  this.start = this.pos;
  if (this.options.locations) {
    this.startLoc = this.curPosition();
  }
  if (this.pos >= this.input.length) {
    return this.finishToken(types$1.eof);
  }
  if (curContext.override) {
    return curContext.override(this);
  } else {
    this.readToken(this.fullCharCodeAtPos());
  }
};
pp2.readToken = function(code2) {
  if (isIdentifierStart(code2, this.options.ecmaVersion >= 6) || code2 === 92) {
    return this.readWord();
  }
  return this.getTokenFromCode(code2);
};
pp2.fullCharCodeAt = function(pos) {
  var code2 = this.input.charCodeAt(pos);
  if (code2 <= 55295 || code2 >= 56320) {
    return code2;
  }
  var next = this.input.charCodeAt(pos + 1);
  return next <= 56319 || next >= 57344 ? code2 : (code2 << 10) + next - 56613888;
};
pp2.fullCharCodeAtPos = function() {
  return this.fullCharCodeAt(this.pos);
};
pp2.skipBlockComment = function() {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) {
    this.raise(this.pos - 2, "Unterminated comment");
  }
  this.pos = end + 2;
  if (this.options.locations) {
    for (var nextBreak = void 0, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1; ) {
      ++this.curLine;
      pos = this.lineStart = nextBreak;
    }
  }
  if (this.options.onComment) {
    this.options.onComment(
      true,
      this.input.slice(start + 2, end),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp2.skipLineComment = function(startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch2 = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && !isNewLine(ch2)) {
    ch2 = this.input.charCodeAt(++this.pos);
  }
  if (this.options.onComment) {
    this.options.onComment(
      false,
      this.input.slice(start + startSkip, this.pos),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp2.skipSpace = function() {
  loop: while (this.pos < this.input.length) {
    var ch2 = this.input.charCodeAt(this.pos);
    switch (ch2) {
      case 32:
      case 160:
        ++this.pos;
        break;
      case 13:
        if (this.input.charCodeAt(this.pos + 1) === 10) {
          ++this.pos;
        }
      case 10:
      case 8232:
      case 8233:
        ++this.pos;
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        break;
      case 47:
        switch (this.input.charCodeAt(this.pos + 1)) {
          case 42:
            this.skipBlockComment();
            break;
          case 47:
            this.skipLineComment(2);
            break;
          default:
            break loop;
        }
        break;
      default:
        if (ch2 > 8 && ch2 < 14 || ch2 >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch2))) {
          ++this.pos;
        } else {
          break loop;
        }
    }
  }
};
pp2.finishToken = function(type, val) {
  this.end = this.pos;
  if (this.options.locations) {
    this.endLoc = this.curPosition();
  }
  var prevType = this.type;
  this.type = type;
  this.value = val;
  this.updateContext(prevType);
};
pp2.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) {
    return this.readNumber(true);
  }
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
    this.pos += 3;
    return this.finishToken(types$1.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(types$1.dot);
  }
};
pp2.readToken_slash = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;
    return this.readRegexp();
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.slash, 1);
};
pp2.readToken_mult_modulo_exp = function(code2) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  var tokentype = code2 === 42 ? types$1.star : types$1.modulo;
  if (this.options.ecmaVersion >= 7 && code2 === 42 && next === 42) {
    ++size;
    tokentype = types$1.starstar;
    next = this.input.charCodeAt(this.pos + 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, size + 1);
  }
  return this.finishOp(tokentype, size);
};
pp2.readToken_pipe_amp = function(code2) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code2) {
    if (this.options.ecmaVersion >= 12) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 === 61) {
        return this.finishOp(types$1.assign, 3);
      }
    }
    return this.finishOp(code2 === 124 ? types$1.logicalOR : types$1.logicalAND, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(code2 === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1);
};
pp2.readToken_caret = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.bitwiseXOR, 1);
};
pp2.readToken_plus_min = function(code2) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code2) {
    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(types$1.incDec, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.plusMin, 1);
};
pp2.readToken_lt_gt = function(code2) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code2) {
    size = code2 === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) {
      return this.finishOp(types$1.assign, size + 1);
    }
    return this.finishOp(types$1.bitShift, size);
  }
  if (next === 33 && code2 === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) {
    size = 2;
  }
  return this.finishOp(types$1.relational, size);
};
pp2.readToken_eq_excl = function(code2) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  }
  if (code2 === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    this.pos += 2;
    return this.finishToken(types$1.arrow);
  }
  return this.finishOp(code2 === 61 ? types$1.eq : types$1.prefix, 1);
};
pp2.readToken_question = function() {
  var ecmaVersion2 = this.options.ecmaVersion;
  if (ecmaVersion2 >= 11) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 46) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 < 48 || next2 > 57) {
        return this.finishOp(types$1.questionDot, 2);
      }
    }
    if (next === 63) {
      if (ecmaVersion2 >= 12) {
        var next2$1 = this.input.charCodeAt(this.pos + 2);
        if (next2$1 === 61) {
          return this.finishOp(types$1.assign, 3);
        }
      }
      return this.finishOp(types$1.coalesce, 2);
    }
  }
  return this.finishOp(types$1.question, 1);
};
pp2.readToken_numberSign = function() {
  var ecmaVersion2 = this.options.ecmaVersion;
  var code2 = 35;
  if (ecmaVersion2 >= 13) {
    ++this.pos;
    code2 = this.fullCharCodeAtPos();
    if (isIdentifierStart(code2, true) || code2 === 92) {
      return this.finishToken(types$1.privateId, this.readWord1());
    }
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString(code2) + "'");
};
pp2.getTokenFromCode = function(code2) {
  switch (code2) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46:
      return this.readToken_dot();
    // Punctuation tokens.
    case 40:
      ++this.pos;
      return this.finishToken(types$1.parenL);
    case 41:
      ++this.pos;
      return this.finishToken(types$1.parenR);
    case 59:
      ++this.pos;
      return this.finishToken(types$1.semi);
    case 44:
      ++this.pos;
      return this.finishToken(types$1.comma);
    case 91:
      ++this.pos;
      return this.finishToken(types$1.bracketL);
    case 93:
      ++this.pos;
      return this.finishToken(types$1.bracketR);
    case 123:
      ++this.pos;
      return this.finishToken(types$1.braceL);
    case 125:
      ++this.pos;
      return this.finishToken(types$1.braceR);
    case 58:
      ++this.pos;
      return this.finishToken(types$1.colon);
    case 96:
      if (this.options.ecmaVersion < 6) {
        break;
      }
      ++this.pos;
      return this.finishToken(types$1.backQuote);
    case 48:
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) {
        return this.readRadixNumber(16);
      }
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) {
          return this.readRadixNumber(8);
        }
        if (next === 98 || next === 66) {
          return this.readRadixNumber(2);
        }
      }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return this.readNumber(false);
    // Quotes produce strings.
    case 34:
    case 39:
      return this.readString(code2);
    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.
    case 47:
      return this.readToken_slash();
    case 37:
    case 42:
      return this.readToken_mult_modulo_exp(code2);
    case 124:
    case 38:
      return this.readToken_pipe_amp(code2);
    case 94:
      return this.readToken_caret();
    case 43:
    case 45:
      return this.readToken_plus_min(code2);
    case 60:
    case 62:
      return this.readToken_lt_gt(code2);
    case 61:
    case 33:
      return this.readToken_eq_excl(code2);
    case 63:
      return this.readToken_question();
    case 126:
      return this.finishOp(types$1.prefix, 1);
    case 35:
      return this.readToken_numberSign();
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString(code2) + "'");
};
pp2.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};
pp2.readRegexp = function() {
  var escaped, inClass, start = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(start, "Unterminated regular expression");
    }
    var ch2 = this.input.charAt(this.pos);
    if (lineBreak.test(ch2)) {
      this.raise(start, "Unterminated regular expression");
    }
    if (!escaped) {
      if (ch2 === "[") {
        inClass = true;
      } else if (ch2 === "]" && inClass) {
        inClass = false;
      } else if (ch2 === "/" && !inClass) {
        break;
      }
      escaped = ch2 === "\\";
    } else {
      escaped = false;
    }
    ++this.pos;
  }
  var pattern2 = this.input.slice(start, this.pos);
  ++this.pos;
  var flagsStart = this.pos;
  var flags = this.readWord1();
  if (this.containsEsc) {
    this.unexpected(flagsStart);
  }
  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
  state.reset(start, pattern2, flags);
  this.validateRegExpFlags(state);
  this.validateRegExpPattern(state);
  var value = null;
  try {
    value = new RegExp(pattern2, flags);
  } catch (e) {
  }
  return this.finishToken(types$1.regexp, { pattern: pattern2, flags, value });
};
pp2.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
  var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
  var start = this.pos, total = 0, lastCode = 0;
  for (var i2 = 0, e = len == null ? Infinity : len; i2 < e; ++i2, ++this.pos) {
    var code2 = this.input.charCodeAt(this.pos), val = void 0;
    if (allowSeparators && code2 === 95) {
      if (isLegacyOctalNumericLiteral) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
      }
      if (lastCode === 95) {
        this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
      }
      if (i2 === 0) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
      }
      lastCode = code2;
      continue;
    }
    if (code2 >= 97) {
      val = code2 - 97 + 10;
    } else if (code2 >= 65) {
      val = code2 - 65 + 10;
    } else if (code2 >= 48 && code2 <= 57) {
      val = code2 - 48;
    } else {
      val = Infinity;
    }
    if (val >= radix) {
      break;
    }
    lastCode = code2;
    total = total * radix + val;
  }
  if (allowSeparators && lastCode === 95) {
    this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
  }
  if (this.pos === start || len != null && this.pos - start !== len) {
    return null;
  }
  return total;
};
function stringToNumber(str, isLegacyOctalNumericLiteral) {
  if (isLegacyOctalNumericLiteral) {
    return parseInt(str, 8);
  }
  return parseFloat(str.replace(/_/g, ""));
}
function stringToBigInt(str) {
  if (typeof BigInt !== "function") {
    return null;
  }
  return BigInt(str.replace(/_/g, ""));
}
pp2.readRadixNumber = function(radix) {
  var start = this.pos;
  this.pos += 2;
  var val = this.readInt(radix);
  if (val == null) {
    this.raise(this.start + 2, "Expected number in radix " + radix);
  }
  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    val = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
  } else if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  return this.finishToken(types$1.num, val);
};
pp2.readNumber = function(startsWithDot) {
  var start = this.pos;
  if (!startsWithDot && this.readInt(10, void 0, true) === null) {
    this.raise(start, "Invalid number");
  }
  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
  if (octal && this.strict) {
    this.raise(start, "Invalid number");
  }
  var next = this.input.charCodeAt(this.pos);
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
    if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    return this.finishToken(types$1.num, val$1);
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
    octal = false;
  }
  if (next === 46 && !octal) {
    ++this.pos;
    this.readInt(10);
    next = this.input.charCodeAt(this.pos);
  }
  if ((next === 69 || next === 101) && !octal) {
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) {
      ++this.pos;
    }
    if (this.readInt(10) === null) {
      this.raise(start, "Invalid number");
    }
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  var val = stringToNumber(this.input.slice(start, this.pos), octal);
  return this.finishToken(types$1.num, val);
};
pp2.readCodePoint = function() {
  var ch2 = this.input.charCodeAt(this.pos), code2;
  if (ch2 === 123) {
    if (this.options.ecmaVersion < 6) {
      this.unexpected();
    }
    var codePos = ++this.pos;
    code2 = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code2 > 1114111) {
      this.invalidStringToken(codePos, "Code point out of bounds");
    }
  } else {
    code2 = this.readHexChar(4);
  }
  return code2;
};
pp2.readString = function(quote) {
  var out2 = "", chunkStart = ++this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated string constant");
    }
    var ch2 = this.input.charCodeAt(this.pos);
    if (ch2 === quote) {
      break;
    }
    if (ch2 === 92) {
      out2 += this.input.slice(chunkStart, this.pos);
      out2 += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else if (ch2 === 8232 || ch2 === 8233) {
      if (this.options.ecmaVersion < 10) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
      if (this.options.locations) {
        this.curLine++;
        this.lineStart = this.pos;
      }
    } else {
      if (isNewLine(ch2)) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
    }
  }
  out2 += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(types$1.string, out2);
};
var INVALID_TEMPLATE_ESCAPE_ERROR = {};
pp2.tryReadTemplateToken = function() {
  this.inTemplateElement = true;
  try {
    this.readTmplToken();
  } catch (err) {
    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
      this.readInvalidTemplateToken();
    } else {
      throw err;
    }
  }
  this.inTemplateElement = false;
};
pp2.invalidStringToken = function(position, message) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    throw INVALID_TEMPLATE_ESCAPE_ERROR;
  } else {
    this.raise(position, message);
  }
};
pp2.readTmplToken = function() {
  var out2 = "", chunkStart = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated template");
    }
    var ch2 = this.input.charCodeAt(this.pos);
    if (ch2 === 96 || ch2 === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
      if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
        if (ch2 === 36) {
          this.pos += 2;
          return this.finishToken(types$1.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(types$1.backQuote);
        }
      }
      out2 += this.input.slice(chunkStart, this.pos);
      return this.finishToken(types$1.template, out2);
    }
    if (ch2 === 92) {
      out2 += this.input.slice(chunkStart, this.pos);
      out2 += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (isNewLine(ch2)) {
      out2 += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch2) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) {
            ++this.pos;
          }
        case 10:
          out2 += "\n";
          break;
        default:
          out2 += String.fromCharCode(ch2);
          break;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};
pp2.readInvalidTemplateToken = function() {
  for (; this.pos < this.input.length; this.pos++) {
    switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break;
      case "$":
        if (this.input[this.pos + 1] !== "{") {
          break;
        }
      // fall through
      case "`":
        return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos));
      case "\r":
        if (this.input[this.pos + 1] === "\n") {
          ++this.pos;
        }
      // fall through
      case "\n":
      case "\u2028":
      case "\u2029":
        ++this.curLine;
        this.lineStart = this.pos + 1;
        break;
    }
  }
  this.raise(this.start, "Unterminated template");
};
pp2.readEscapedChar = function(inTemplate) {
  var ch2 = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch2) {
    case 110:
      return "\n";
    // 'n' -> '\n'
    case 114:
      return "\r";
    // 'r' -> '\r'
    case 120:
      return String.fromCharCode(this.readHexChar(2));
    // 'x'
    case 117:
      return codePointToString(this.readCodePoint());
    // 'u'
    case 116:
      return "	";
    // 't' -> '\t'
    case 98:
      return "\b";
    // 'b' -> '\b'
    case 118:
      return "\v";
    // 'v' -> '\u000b'
    case 102:
      return "\f";
    // 'f' -> '\f'
    case 13:
      if (this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
      }
    // '\r\n'
    case 10:
      if (this.options.locations) {
        this.lineStart = this.pos;
        ++this.curLine;
      }
      return "";
    case 56:
    case 57:
      if (this.strict) {
        this.invalidStringToken(
          this.pos - 1,
          "Invalid escape sequence"
        );
      }
      if (inTemplate) {
        var codePos = this.pos - 1;
        this.invalidStringToken(
          codePos,
          "Invalid escape sequence in template string"
        );
      }
    default:
      if (ch2 >= 48 && ch2 <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        this.pos += octalStr.length - 1;
        ch2 = this.input.charCodeAt(this.pos);
        if ((octalStr !== "0" || ch2 === 56 || ch2 === 57) && (this.strict || inTemplate)) {
          this.invalidStringToken(
            this.pos - 1 - octalStr.length,
            inTemplate ? "Octal literal in template string" : "Octal literal in strict mode"
          );
        }
        return String.fromCharCode(octal);
      }
      if (isNewLine(ch2)) {
        if (this.options.locations) {
          this.lineStart = this.pos;
          ++this.curLine;
        }
        return "";
      }
      return String.fromCharCode(ch2);
  }
};
pp2.readHexChar = function(len) {
  var codePos = this.pos;
  var n = this.readInt(16, len);
  if (n === null) {
    this.invalidStringToken(codePos, "Bad character escape sequence");
  }
  return n;
};
pp2.readWord1 = function() {
  this.containsEsc = false;
  var word = "", first = true, chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch2 = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch2, astral)) {
      this.pos += ch2 <= 65535 ? 1 : 2;
    } else if (ch2 === 92) {
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) !== 117) {
        this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      }
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) {
        this.invalidStringToken(escStart, "Invalid Unicode escape");
      }
      word += codePointToString(esc);
      chunkStart = this.pos;
    } else {
      break;
    }
    first = false;
  }
  return word + this.input.slice(chunkStart, this.pos);
};
pp2.readWord = function() {
  var word = this.readWord1();
  var type = types$1.name;
  if (this.keywords.test(word)) {
    type = keywords[word];
  }
  return this.finishToken(type, word);
};
var version = "8.17.0";
Parser.acorn = {
  Parser,
  version,
  defaultOptions,
  Position,
  SourceLocation,
  getLineInfo,
  Node,
  TokenType,
  tokTypes: types$1,
  keywordTypes: keywords,
  TokContext,
  tokContexts: types,
  isIdentifierChar,
  isIdentifierStart,
  Token,
  isNewLine,
  lineBreak,
  lineBreakG,
  nonASCIIwhitespace
};
function parse4(input, options) {
  return Parser.parse(input, options);
}

// node_modules/@strudel/transpiler/dist/index.mjs
var import_escodegen = __toESM(require_escodegen(), 1);

// node_modules/estree-walker/src/walker.js
var WalkerBase = class {
  constructor() {
    this.should_skip = false;
    this.should_remove = false;
    this.replacement = null;
    this.context = {
      skip: () => this.should_skip = true,
      remove: () => this.should_remove = true,
      replace: (node) => this.replacement = node
    };
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   * @param {Node} node
   */
  replace(parent, prop, index, node) {
    if (parent && prop) {
      if (index != null) {
        parent[prop][index] = node;
      } else {
        parent[prop] = node;
      }
    }
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   */
  remove(parent, prop, index) {
    if (parent && prop) {
      if (index !== null && index !== void 0) {
        parent[prop].splice(index, 1);
      } else {
        delete parent[prop];
      }
    }
  }
};

// node_modules/estree-walker/src/sync.js
var SyncWalker = class extends WalkerBase {
  /**
   *
   * @param {SyncHandler} [enter]
   * @param {SyncHandler} [leave]
   */
  constructor(enter, leave) {
    super();
    this.should_skip = false;
    this.should_remove = false;
    this.replacement = null;
    this.context = {
      skip: () => this.should_skip = true,
      remove: () => this.should_remove = true,
      replace: (node) => this.replacement = node
    };
    this.enter = enter;
    this.leave = leave;
  }
  /**
   * @template {Node} Parent
   * @param {Node} node
   * @param {Parent | null} parent
   * @param {keyof Parent} [prop]
   * @param {number | null} [index]
   * @returns {Node | null}
   */
  visit(node, parent, prop, index) {
    if (node) {
      if (this.enter) {
        const _should_skip = this.should_skip;
        const _should_remove = this.should_remove;
        const _replacement = this.replacement;
        this.should_skip = false;
        this.should_remove = false;
        this.replacement = null;
        this.enter.call(this.context, node, parent, prop, index);
        if (this.replacement) {
          node = this.replacement;
          this.replace(parent, prop, index, node);
        }
        if (this.should_remove) {
          this.remove(parent, prop, index);
        }
        const skipped = this.should_skip;
        const removed = this.should_remove;
        this.should_skip = _should_skip;
        this.should_remove = _should_remove;
        this.replacement = _replacement;
        if (skipped) return node;
        if (removed) return null;
      }
      let key;
      for (key in node) {
        const value = node[key];
        if (value && typeof value === "object") {
          if (Array.isArray(value)) {
            const nodes = (
              /** @type {Array<unknown>} */
              value
            );
            for (let i2 = 0; i2 < nodes.length; i2 += 1) {
              const item = nodes[i2];
              if (isNode(item)) {
                if (!this.visit(item, node, key, i2)) {
                  i2--;
                }
              }
            }
          } else if (isNode(value)) {
            this.visit(value, node, key, null);
          }
        }
      }
      if (this.leave) {
        const _replacement = this.replacement;
        const _should_remove = this.should_remove;
        this.replacement = null;
        this.should_remove = false;
        this.leave.call(this.context, node, parent, prop, index);
        if (this.replacement) {
          node = this.replacement;
          this.replace(parent, prop, index, node);
        }
        if (this.should_remove) {
          this.remove(parent, prop, index);
        }
        const removed = this.should_remove;
        this.replacement = _replacement;
        this.should_remove = _should_remove;
        if (removed) return null;
      }
    }
    return node;
  }
};
function isNode(value) {
  return value !== null && typeof value === "object" && "type" in value && typeof value.type === "string";
}

// node_modules/estree-walker/src/index.js
function walk(ast, { enter, leave }) {
  const instance = new SyncWalker(enter, leave);
  return instance.visit(ast, null);
}

// node_modules/@strudel/transpiler/dist/index.mjs
var P2 = [];
var E2 = /* @__PURE__ */ new Map();
function F2(e, t = {}) {
  const { wrapAsync: n = false, addReturn: a = true, emitMiniLocations: i2 = true, emitWidgets: p = true } = t, f2 = [];
  let l2 = parse4(e, {
    ecmaVersion: 2022,
    allowAwaitOutsideFunction: true,
    locations: true,
    onComment: f2
  });
  const m3 = ce2(f2, e.length);
  let c2 = [];
  const b2 = (r, x) => {
    const s = E2.get("minilang");
    if (s) {
      const u = `[${r}]`, o = s.getLocations(u, x.start);
      c2 = c2.concat(o);
    } else {
      const u = Yr2(`"${r}"`, x.start, e);
      c2 = c2.concat(u);
    }
  };
  let y = [];
  walk(l2, {
    enter(r, x) {
      if (se2(r)) {
        const { name: s } = r.tag, u = E2.get(s), o = r.quasi.quasis[0].value.raw, h = r.quasi.start + 1;
        if (i2) {
          const C3 = u.getLocations(o, h);
          c2 = c2.concat(C3);
        }
        return this.skip(), this.replace(ue3(s, o, h));
      }
      if (le2(r, "tidal")) {
        const s = r.quasi.quasis[0].value.raw, u = r.quasi.start + 1;
        if (i2) {
          const o = oe2(s, u);
          c2 = c2.concat(o);
        }
        return this.skip(), this.replace(pe2(s, u));
      }
      if (U3(r, x)) {
        if (q2(r.start, m3))
          return;
        const { quasis: s } = r, { raw: u } = s[0].value;
        return this.skip(), i2 && b2(u, r), this.replace(T(u, r));
      }
      if (G2(r)) {
        if (q2(r.start, m3))
          return;
        const { value: s } = r;
        return this.skip(), i2 && b2(s, r), this.replace(T(s, r));
      }
      if (X(r))
        return p && y.push({
          from: r.arguments[0].start,
          to: r.arguments[0].end,
          value: r.arguments[0].raw,
          // don't use value!
          min: r.arguments[1]?.value ?? 0,
          max: r.arguments[2]?.value ?? 1,
          step: r.arguments[3]?.value,
          type: "slider"
        }), this.replace(Z3(r));
      if (Y2(r)) {
        const s = r.callee.property.name, u = y.filter((h) => h.type === s).length, o = {
          to: r.end,
          index: u,
          type: s,
          id: t.id
        };
        return p && y.push(o), this.replace(te3(r, o));
      }
      if (re2(r, x))
        return this.replace(ne2(r));
      if (ie2(r))
        return this.replace(ae2(r));
    },
    leave(r, x, s, u) {
      if (!R2(r)) return;
      let [o, ...h] = r.arguments;
      if (!o) throw new Error("K(...) requires an expression");
      _(o) && (o = {
        type: "CallExpression",
        callee: o,
        arguments: [],
        optional: false
      });
      const { template: C3, patternExprs: k2 } = B2(o);
      if (k2.length) {
        const d2 = [{ type: "Literal", value: C3 }, ...k2, ...h];
        let L3 = r.callee;
        return L3.type === "ChainExpression" && (L3 = L3.expression), L3.type === "MemberExpression" ? this.replace({
          type: "CallExpression",
          callee: W3(L3.object),
          arguments: d2,
          optional: false
        }) : this.replace({
          type: "CallExpression",
          callee: { type: "Identifier", name: "worklet" },
          arguments: d2,
          optional: false
        });
      }
      const M = [{ type: "Literal", value: S3(o) }, ...h];
      let w2 = r.callee;
      return w2.type === "ChainExpression" && (w2 = w2.expression), w2.type === "MemberExpression" ? this.replace({
        type: "CallExpression",
        callee: W3(w2.object),
        arguments: M,
        optional: false
      }) : this.replace({
        type: "CallExpression",
        callee: { type: "Identifier", name: "worklet" },
        arguments: M,
        optional: false
      });
    }
  });
  let { body: g } = l2;
  if (!g.length)
    console.warn("empty body -> fallback to silence"), g.push({
      type: "ExpressionStatement",
      expression: {
        type: "Identifier",
        name: "silence"
      }
    });
  else if (!g?.[g.length - 1]?.expression)
    throw new Error("unexpected ast format without body expression");
  if (a) {
    const { expression: r } = g[g.length - 1];
    g[g.length - 1] = {
      type: "ReturnStatement",
      argument: r
    };
  }
  let v = import_escodegen.default.generate(l2);
  return n && (v = `(async ()=>{${v}})()`), i2 ? { output: v, miniLocations: c2, widgets: y } : { output: v };
}
function R2(e) {
  if (e.type !== "CallExpression") return false;
  let t = e.callee;
  return t.type === "ChainExpression" && (t = t.expression), t.type === "MemberExpression" ? !t.computed && t.property?.name === "K" : t.type === "Identifier" && t.name === "K";
}
function _(e) {
  return e.type !== "ArrowFunctionExpression" && e.type !== "FunctionExpression" || e.params.length ? false : e.body?.type === "BlockStatement";
}
function S3(e) {
  return import_escodegen.default.generate(e, { format: { semicolons: false } });
}
function B2(e) {
  const t = I2(e), n = /* @__PURE__ */ new Map(), a = [];
  if (walk(t, {
    enter(l2, m3, c2, b2) {
      n.set(l2, { parent: m3, prop: c2, index: b2 });
      const y = J2(l2);
      y && (a.push({ node: l2, patternExpr: y }), this.skip());
    }
  }), !a.length)
    return { template: S3(t), patternExprs: [] };
  a.sort((l2, m3) => A2(l2.node) - A2(m3.node));
  const i2 = a.map(({ patternExpr: l2 }) => I2(l2));
  let p = t;
  return a.forEach(({ node: l2 }, m3) => {
    p = z3(l2, V2(m3), n, p);
  }), { template: S3(p), patternExprs: i2 };
}
function J2(e) {
  if (H(e)) {
    const t = e.arguments?.[0];
    if (!t)
      throw new Error("S(...) requires an argument");
    return t;
  }
  return j2(e) ? e : null;
}
function H(e) {
  if (e.type !== "CallExpression")
    return false;
  const t = e.callee;
  return t.type === "Identifier" ? t.name === "S" : t.type === "MemberExpression" && !t.computed ? t.property?.name === "S" : false;
}
function Q3() {
  return E2.get("minilang")?.name || "m";
}
function j2(e) {
  if (e.type !== "CallExpression")
    return false;
  const t = e.callee;
  if (t.type !== "Identifier" || t.name !== Q3())
    return false;
  const n = e.arguments?.[0];
  return n?.type === "Literal" && typeof n.value == "string";
}
function A2(e) {
  if (typeof e.start == "number")
    return e.start;
  if (j2(e)) {
    const t = e.arguments?.[1];
    if (t?.type === "Literal" && typeof t.value == "number")
      return t.value;
  }
  return 0;
}
function V2(e) {
  return {
    type: "MemberExpression",
    object: { type: "Identifier", name: "pat" },
    property: { type: "Literal", value: e },
    computed: true,
    optional: false
  };
}
function z3(e, t, n, a) {
  const i2 = n.get(e);
  if (!i2 || !i2.parent)
    return t;
  const { parent: p, prop: f2, index: l2 } = i2;
  return Array.isArray(p[f2]) ? p[f2][l2] = t : p[f2] = t, n.set(t, { parent: p, prop: f2, index: l2 }), a;
}
function I2(e) {
  return JSON.parse(JSON.stringify(e));
}
function W3(e) {
  return {
    type: "MemberExpression",
    object: e,
    property: { type: "Identifier", name: "worklet" },
    computed: false,
    optional: false
  };
}
function G2(e, t, n) {
  return e.type !== "Literal" ? false : e.raw[0] === '"';
}
function U3(e, t) {
  return e.type === "TemplateLiteral" && t.type !== "TaggedTemplateExpression";
}
function T(e, t) {
  const { start: n } = t, a = E2.get("minilang");
  let i2 = "m";
  return a && a.name && (i2 = a.name), {
    type: "CallExpression",
    callee: {
      type: "Identifier",
      name: i2
    },
    arguments: [
      { type: "Literal", value: e },
      { type: "Literal", value: n }
    ],
    optional: false
  };
}
function X(e) {
  return e.type === "CallExpression" && e.callee.name === "slider";
}
function Y2(e) {
  return e.type === "CallExpression" && P2.includes(e.callee.property?.name);
}
function Z3(e) {
  const t = "slider_" + e.arguments[0].start;
  return e.arguments.unshift({
    type: "Literal",
    value: t,
    raw: t
  }), e.callee.name = "sliderWithID", e;
}
function ee3(e) {
  return `${e.id || ""}_widget_${e.type}_${e.index}`;
}
function te3(e, t) {
  const n = ee3(t);
  return e.arguments.unshift({
    type: "Literal",
    value: n,
    raw: n
  }), e;
}
function re2(e, t) {
  return e.type === "CallExpression" && e.callee.name === "samples" && t.type !== "AwaitExpression";
}
function ne2(e) {
  return {
    type: "AwaitExpression",
    argument: e
  };
}
function ie2(e) {
  return e.type === "LabeledStatement";
}
function ae2(e) {
  return {
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: e.body.expression,
        property: {
          type: "Identifier",
          name: "p"
        }
      },
      arguments: [
        {
          type: "Literal",
          value: e.label.name,
          raw: `'${e.label.name}'`
        }
      ]
    }
  };
}
function se2(e) {
  return e.type === "TaggedTemplateExpression" && E2.has(e.tag.name);
}
function le2(e, t) {
  return e.type === "TaggedTemplateExpression" && e.tag.name === t;
}
function oe2(e, t) {
  return e.split("").reduce((n, a, i2) => (a !== '"' || (!n.length || n[n.length - 1].length > 1 ? n.push([i2 + 1]) : n[n.length - 1].push(i2)), n), []).map(([n, a]) => {
    const i2 = e.slice(n, a);
    return Yr2(`"${i2}"`, t + n - 1);
  }).flat();
}
function pe2(e, t) {
  return {
    type: "CallExpression",
    callee: {
      type: "Identifier",
      name: "tidal"
    },
    arguments: [
      { type: "Literal", value: e },
      { type: "Literal", value: t }
    ],
    optional: false
  };
}
function ue3(e, t, n) {
  return {
    type: "CallExpression",
    callee: {
      type: "Identifier",
      name: e
    },
    arguments: [
      { type: "Literal", value: t },
      { type: "Literal", value: n }
    ],
    optional: false
  };
}
function ce2(e, t) {
  const n = [], a = [];
  for (const i2 of e) {
    const p = i2.value.trim();
    if (p.startsWith("mini-off"))
      a.push(i2.start);
    else if (p.startsWith("mini-on")) {
      const f2 = a.pop();
      n.push([f2, i2.end]);
    }
  }
  for (; a.length; ) {
    const i2 = a.pop();
    n.push([i2, t]);
  }
  return n;
}
function q2(e, t) {
  for (const [n, a] of t)
    if (e >= n && e < a)
      return true;
  return false;
}

// engine/golden/hap-dump.src.mjs
await xn(dist_exports, dist_exports2);
var pPatterns = {};
var cpm = null;
var anon = 0;
f.prototype.p = function(id2) {
  let key = String(id2);
  if (key.includes("$")) key = key + anon++;
  pPatterns[key] = this;
  return this;
};
globalThis.setcpm = (x) => {
  cpm = x;
};
var code = process.env.CODE;
var cycles = Number(process.env.CYCLES || 1);
var evaled = await On(code, F2);
var pattern = Object.keys(pPatterns).length ? z(...Object.values(pPatterns)) : evaled?.pattern ?? evaled;
var cps = (cpm ?? 60) / 60;
var haps = pattern.queryArc(0, cycles, { _cps: cps }).filter((h) => h.hasOnset());
var out = haps.map((h) => {
  h.ensureObjectValue();
  return { value: h.value, begin: h.whole.begin.valueOf() / cps, duration: h.duration.valueOf() / cps };
});
console.log(JSON.stringify({ cps, haps: out }));
