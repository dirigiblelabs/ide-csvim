JSON = {
    parse: function (str, options) {
        this.str = str;
        this.i = 0;
        this.nfirstchars = '-0123456789.';
        this.nchars = '-0123456789.eE';
        this.n
        return this.parseValue();
    },
    isWhiteSpace: function (c) {
        return c == ' ' || c == '\r' || c == '\n' || c == '\t';
    },
    skipWhiteSpace: function () {
        while (this.i < this.str.length && this.isWhiteSpace(this.str.charAt(this.i))) this.i++;
    },
    parseValue: function () {
        this.skipWhiteSpace();
        if (this.i == this.str.length) return null;
        var c = this.str.charAt(this.i);
        if (c == '{') return this.parseObject();
        else if (c == '[') return this.parseArray();
        else if (c == '\"') return this.parseString('\"');
        else if (c == '\'') return this.parseString('\'');
        else if (this.nfirstchars.indexOf(c) != -1) return this.parseNumber();
        else if (c == 't') return this.parseLiteral('true', true);
        else if (c == 'f') return this.parseLiteral('false', false);
        else if (c == 'n') return this.parseLiteral('null', null);
        else if (c == 'N') return this.parseLiteral('NaN', NaN);
        else if (c == 'u') return this.parseLiteral('undefined', undefined);
        throw "Invalid json";
    },
    parseLiteral: function (literal, value) {
        if (literal.length > this.str.length - this.i) {
            throw "Expecting " + literal;
        }
        for (var i = 0; i < literal.length; i++) {
            if (literal.charAt(i) != this.str.charAt(this.i++)) {
                throw "Expecting " + literal;
            }
        }
        return value;
    },
    parseNumber: function () {
        var startIndex = this.i;
        var c;
        while (this.nchars.indexOf(this.str.charAt(this.i)) != -1) {
            this.i++;
        }
        return new Number(this.str.substring(startIndex, this.i));
    },
    parseString: function (quote) {
        var startIndex = ++this.i;
        var c;
        var s = '';
        while ((c = this.str.charAt(this.i)) != quote) {
            if (c == '\\') {
                this.i++;
                c = this.str.charAt(this.i);
                if (c == 'r') s += '\r';
                else if (c == 'n') s += '\n';
                else if (c == 't') s += '\t';
                else if (c == 'f') s += '\f';
                // Note escaped unicode not handled
                else s += c;
            } else s += c;
            this.i++;
        }
        this.i++;
        return s;
    },
    parseObject: function () {
        this.i++;
        this.skipWhiteSpace();
        if (this.str.charAt(this.i) == '}') {
            this.i++;
            return {};
        }
        var o = {};
        var c;
        while (true) {
            var name = this.parseValue();
            this.skipWhiteSpace();
            c = this.str.charAt(this.i);
            if (c != ':') throw "Expecting :";
            this.i++;
            this.skipWhiteSpace();
            var value = this.parseValue();
            this.skipWhiteSpace();
            o[name] = value;
            c = this.str.charAt(this.i);
            if (c == ',') {
                this.i++;
                this.skipWhiteSpace();
            } else break;
        }
        if (c != '}') {
            Response.Write(this.str.substring(this.i));
            throw "Expecting }";
        }
        this.i++;
        return o;
    },
    parseArray: function () {
        this.i++;
        this.skipWhiteSpace();
        if (this.str.charAt(this.i) == ']') {
            this.i++;
            return [];
        }
        var a = [];
        var c;
        while (true) {
            var value = this.parseValue();
            a.push(value);
            this.skipWhiteSpace();
            c = this.str.charAt(this.i);
            if (c == ',') {
                this.i++;
                this.skipWhiteSpace();
            } else break;
        }
        if (c != ']') {
            throw "Expecting ]";
        }
        this.i++;
        return a;
    }
}