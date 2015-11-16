/**
 * Created by dennis on 09/11/15.
 */

function Set() {
    this.elemSet = Object.create(null);

    this.isElem = function (elem) {
        return elem in this.elemSet;
    };

    this.del = function (elem) {
        delete this.elemSet[elem];
    };

    this.delAll = function (otherSet) {
        for (otherElem in otherSet) {
            this.del(otherElem);
        }
    };

    this.put = function (elem) {
        this.elemSet[elem] = true;
    };

    this.putAll = function (otherSet) {
        for (otherElem in otherSet) {
            this.put(otherElem);
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
                intersec.add(elem);
            }
        }
    };

    this.symDiff = function (other) {
        var symDiff = this.union(other);
        symDiff.delAll(this.intersec(other));
    }
}