/**
 * Created by dennis on 09/11/15.
 */

function Set() {
    this.elemSet = Object.create(null);
    this.length = 0;

    this.isElem = function (elem) {
        return elem in this.elemSet;
    };

    this.del = function (elem) {
        if (elem in this.elemSet) {
            delete this.elemSet[elem];
            this.length--;
        }
    };

    this.delAll = function (otherSet) {
        for (otherElem in otherSet) {
            this.del(otherElem);
        }
    };

    this.put = function (elem) {
        if (!elem in this.elemSet) {
            this.elemSet[elem] = true;
            this.length++;
        }
    };

    this.putAll = function (other) {
        if (other.constructor == Array) {
            for (var i=0; i<other.length; i++) {
                this.put(other[i]);
            }
        } else if (other.constructor == Set) {
            for (otherElem in other) {
                this.put(otherElem);
            }
        }
    };

    this.union = function (other) {
        var union = new Set();
        union.putAll(this);
        union.putAll(other);
        return union;
    };

    this.intersec = function (other) {
        var intersec = new Set();

        for (elem in this.elemSet) {
            if (other.isElem(elem)) {
                intersec.put(elem);
            }
        }
    };

    this.symDiff = function (other) {
        var symDiff = this.union(other);
        symDiff.delAll(this.intersec(other));
    }
}