(function(exports) {

  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  var __as_num = function(n) { return n * 1; };
  var __get_time = function () { return new Date().getTime(); };

  var MIN = 0;
  var MAX = 1000;
  var STORAGEKEY = "MySnackTodayCart";
  var STORAGETTL = (15 * 60 * 1000); // 15 minutes in milliseconds

  Cart = function (item_definition_list, do_not_restore) {
      this.items = item_definition_list;
      this.empty();

      if (!do_not_restore)
          this._restore();

      this.inc_quantity = __bind(this.inc_quantity, this);
      this.dec_quantity = __bind(this.dec_quantity, this);
      this.set_quantity = __bind(this.set_quantity, this);
      this.get_quantity = __bind(this.get_quantity, this);
      this.empty = __bind(this.empty, this);
      this.to_json = __bind(this.to_json, this);
  };

  Cart.prototype._change_quantity = function(item_id, quantity, mode) {
      quantity = this._as_valid_quantity_or_NaN(quantity);
      if (isNaN(quantity)) return;

      item_id = __as_num(item_id);

      var idx = this._find_index_of_item(item_id);
      if (idx < 0) {
          console.error("Item id "+item_id+" not found");
          return;
      }

      var item = this.items[idx];
      if (mode === "inc") {
          item.quantity += quantity;
      }
      else if (mode == "dec") {
          item.quantity -= quantity;
      }
      else if (mode == "set") {
          item.quantity = quantity;
      }
      else {
          console.error("_change_quantity error");
          return;
      }

      item.quantity = this._safe_quantity(item.quantity);

      this._shake_item_list();
      this.update_stats();
      this._save();
  };

  Cart.prototype._shake_item_list = function () {
      // this will mutate the item list so the
      // render (rivets) will know that he needs
      // to update the view
      this.items.push({});
      this.items.pop();
  };

  Cart.prototype._find_index_of_item = function (item_id) {
      for (var i = 0; i < this.items.length; ++i) {
          var item = this.items[i];
          if (item.id === item_id)
              return i;
      }

      return -1;
  };

  Cart.prototype._exists_item = function (item_id) {
      return this._find_index_of_item(item_id) >= 0;
  };

  Cart.prototype.inc_quantity = function (item_id, quantity) {
      quantity = this._as_valid_quantity_or_NaN(quantity, 1);
      if (isNaN(quantity)) return;

      item_id = __as_num(item_id);
      this._change_quantity(item_id, quantity, 'inc');
  };

  Cart.prototype.dec_quantity = function (item_id, quantity) {
      quantity = this._as_valid_quantity_or_NaN(quantity, 1);
      if (isNaN(quantity)) return;

      item_id = __as_num(item_id);
      this._change_quantity(item_id, quantity, 'dec');
  };
  Cart.prototype.set_quantity = function (item_id, quantity) {
      quantity = this._as_valid_quantity_or_NaN(quantity);
      if (isNaN(quantity)) return;

      item_id = __as_num(item_id);
      this._change_quantity(item_id, quantity, 'set');
  };

  Cart.prototype.get_quantity = function (item_id) {
      item_id = __as_num(item_id);

      var idx = this._find_index_of_item(item_id);
      return this.items[idx].quantity;
  };

  Cart.prototype._safe_quantity = function (quantity) {
      if (quantity <= MIN) {
          return MIN;
      }

      if (quantity >= MAX) {
          quantity = MAX;
      }

      if (MIN <= quantity && quantity <= MAX) {
          return quantity;
      }

      console.error("Invalid quantity");
      return MIN;
  };

  Cart.prototype._as_valid_quantity_or_NaN = function (quantity, default_val) {
      if (quantity === null || quantity === undefined) {
          quantity = default_val;
      }

      quantity = parseInt(quantity);
      if (isNaN(quantity)) {
          return NaN;
      }

      if (quantity < 0) {
          return NaN;
      }

      return quantity;
  };

  Cart.prototype.empty = function () {
      for (var i = 0; i < this.items.length; ++i) {
          this.items[i].quantity = 0;
      }

      this.update_stats();
  };

  Cart.prototype.update_stats = function () {
      this.total_quantity = 0;
      this.total_price = 0;
      this.total_price_off = 0;

      for (var i = 0; i < this.items.length; ++i) {
          var item = this.items[i];
          this.total_quantity += item.quantity;
          this.total_price += item.price * item.quantity;
          this.total_price_off += (item.price_off || 0) * item.quantity;
      }
  };

  Cart.prototype.to_json = function () {
      var raw_items = []
      for (var i = 0; i < this.items.length; ++i) {
          var item = this.items[i];

          if (item.quantity <= 0) {
              continue;
          }

          raw_items.push({id: item.id, q: item.quantity});
      }

      return JSON.stringify({
          d: __get_time(),     // add UTC date for freshness
          i: raw_items,
      });
  };

  Cart.prototype._from_json = function (s, time_to_live) {
      // safe default, if anything wrong happen, assume that
      // we don't have a serialized item list
      var raw_items = [];

      if (s) {
          try {
              var raw_obj = JSON.parse(s);
              var elapsed = Math.max(1, (__get_time() - raw_obj.d));
              if (elapsed < time_to_live)  // discard if not fresh
                  raw_items = raw_obj.i;
          }
          catch (e) {
              console.error("_from_json");
          }
      }

      // empty the cart, then fill it: this avoid any mixing up
      // with a previous cart's state
      this.empty();
      for (var i = 0; i < raw_items.length; ++i) {
          var raw_elem = raw_items[i];

          if (this._exists_item(raw_elem.id))
              this.set_quantity(raw_elem.id, raw_elem.q);
      }
  };

  Cart.prototype._save = function () {
      if (typeof(Storage) !== "undefined") {
          sessionStorage[STORAGEKEY] = this.to_json();
      }
      else {
          console.error("Session Storage is not supported on your browser");
      }
  };

  Cart.prototype._restore = function () {
      if (typeof(Storage) !== "undefined") {
          this._from_json(sessionStorage[STORAGEKEY], STORAGETTL);
      }
      else {
          console.error("Session Storage is not supported on your browser");
      }
  };



  var test = function () {
      function assert_eq(expected, found, what) {
          if (expected !== found) {
              console.error(""+what+": Expected "+expected+" but found "+found);
          }
      }

      (function change_quantities() {
          var seed = [
              {id: 0, quantity: 0, desc: "foo", price: 1 },
              {id: 1, quantity: 0, desc: "bar", price: 4, price_off: 2 },
          ];

          var cart = new Cart(seed, true);

          assert_eq(0, cart.items[0].quantity, "initial item 0 quantity");
          assert_eq(0, cart.items[1].quantity, "initial item 1 quantity");

          assert_eq(0, cart.total_quantity, "initial total quantity");
          assert_eq(0, cart.total_price, "initial total price");
          assert_eq(0, cart.total_price_off, "initial total price_off");

          cart.inc_quantity(0);
          cart.inc_quantity(1, 4);

          assert_eq(1, cart.items[0].quantity, "item 0 inc (default)");
          assert_eq(4, cart.items[1].quantity, "item 1 inc (custom quantity)");

          cart.inc_quantity(0);
          cart.inc_quantity(1, 4);

          assert_eq(2, cart.items[0].quantity, "item 0 2nd inc (default)");
          assert_eq(8, cart.items[1].quantity, "item 1 2nd inc (custom quantity)");

          assert_eq(10, cart.total_quantity, "post incs total quantity");
          assert_eq(2+8*4, cart.total_price, "post incs total price");
          assert_eq(2*8, cart.total_price_off, "post incs total price_off");

          cart.set_quantity(0, 4);
          cart.set_quantity(1, 0);

          assert_eq(4, cart.items[0].quantity, "item 0 set quantity");
          assert_eq(0, cart.items[1].quantity, "item 1 set quantity");

          cart.set_quantity(1);
          assert_eq(4, cart.items[0].quantity, "item 0 set (default, ignored)");

          assert_eq(4, cart.total_quantity, "post set total quantity");
          assert_eq(4, cart.total_price, "post set total price");
          assert_eq(0, cart.total_price_off, "post set total price_off");

          cart.dec_quantity(0);

          assert_eq(3, cart.items[0].quantity, "item 0 dec (default)");

          cart.dec_quantity(0, 2);

          assert_eq(1, cart.items[0].quantity, "item 0 2nd dec (custom quantity)");

          assert_eq(1, cart.total_quantity, "post dec total quantity");
          assert_eq(1, cart.total_price, "post dec total price");
          assert_eq(0, cart.total_price_off, "post dec total price_off");

          cart.dec_quantity(0, 8);
          cart.dec_quantity(1);

          assert_eq(0, cart.items[0].quantity, "item 0 dec (min value)");
          assert_eq(0, cart.items[1].quantity, "item 1 dec (min value)");

          assert_eq(0, cart.total_quantity, "post dec (min value) total quantity");
          assert_eq(0, cart.total_price, "post dec (min value) total price");
          assert_eq(0, cart.total_price_off, "post dec (min value) total price_off");

          cart.set_quantity(0, 999999999999);
          cart.set_quantity(1, 999999999999);

          assert_eq(1000, cart.items[0].quantity, "item 0 set (max value)");
          assert_eq(1000, cart.items[1].quantity, "item 1 set (max value)");

          assert_eq(2000, cart.total_quantity, "post set (max value) total quantity");
          assert_eq(1000 + 1000*4, cart.total_price, "post set (max value) total price");
          assert_eq(1000 * 2, cart.total_price_off, "post set (max value) total price_off");

          cart.empty();

          assert_eq(0, cart.items[0].quantity, "item 0 empty");
          assert_eq(0, cart.items[1].quantity, "item 1 empty");

          assert_eq(0, cart.total_quantity, "post empty total quantity");
          assert_eq(0, cart.total_price, "post empty total price");
          assert_eq(0, cart.total_price_off, "post empty total price_off");
      })();

      (function quantity_type_conversion() {
          var seed = [
              {id: 0, quantity: 0, desc: "foo", price: 1 },
              {id: 1, quantity: 0, desc: "foo", price: 1 },
              {id: 2, quantity: 0, desc: "foo", price: 1 },
          ];

          var cart = new Cart(seed, true);

          // initialize
          cart.set_quantity(0, 4);
          cart.set_quantity(1, 4);
          cart.set_quantity(2, 4);

          cart.set_quantity(0, +1);
          cart.inc_quantity(1, +1);
          cart.dec_quantity(2, +1);
          assert_eq(1, cart.items[0].quantity, "set positive integer");
          assert_eq(1+5+3, cart.total_quantity, "post 1st set total quantity");

          cart.set_quantity(0, -2);
          cart.inc_quantity(1, -2);
          cart.dec_quantity(2, -2);
          assert_eq(1, cart.items[0].quantity, "set negative integer (ignored)");
          assert_eq(1+5+3, cart.total_quantity, "post 2nd set total quantity");

          cart.set_quantity(0, 2.7);
          cart.inc_quantity(1, 2.7);
          cart.dec_quantity(2, 2.7);
          assert_eq(2, cart.items[0].quantity, "set positive float (truncated)");
          assert_eq(2+7+1, cart.total_quantity, "post 3rd set total quantity");

          cart.set_quantity(0, "1");
          cart.inc_quantity(1, "1");
          cart.dec_quantity(2, "1");
          assert_eq(1, cart.items[0].quantity, "set positive integer as string");
          assert_eq(1+8+0, cart.total_quantity, "post 4th set total quantity");
      })();

      (function initialize_empty() {
          var seed = [
              {id: 0, quantity: 2, desc: "foo", price: 1 },
              {id: 1, quantity: 3, desc: "foo", price: 1 },
              {id: 2, quantity: 4, desc: "foo", price: 1 },
          ];

          var cart = new Cart(seed, true);

          assert_eq(0, cart.items[0].quantity, "1st empty");
          assert_eq(0, cart.items[1].quantity, "2nd empty");
          assert_eq(0, cart.items[2].quantity, "3rd empty");
          assert_eq(0, cart.total_quantity, "total quantity empty");
      })();

      (function serialization() {
          var seed = [
              {id: 0, quantity: 0, desc: "foo", price: 1 },
              {id: 1, quantity: 0, desc: "foo", price: 2, price_off: 1 },
          ];

          // get a clone, Cart will grab this be reference and not
          // by value so we need to work with a copy
          var seed_clone = JSON.parse(JSON.stringify(seed));

          var cart_A = new Cart(seed, true);
          var cart_B = new Cart(seed_clone, true);

          cart_B.set_quantity(0, 5); // make it dirty

          cart_B._from_json(cart_A.to_json(), STORAGETTL);
          assert_eq(0, cart_B.items[0].quantity, "1st item empty");
          assert_eq(0, cart_B.items[1].quantity, "2st item empty");
          assert_eq(0, cart_B.total_quantity, "empty total quantity");
          assert_eq(0, cart_B.total_price, "empty total price");
          assert_eq(0, cart_B.total_price_off, "empty total price_off");

          cart_B.set_quantity(0, 5); // make it dirty

          cart_A.set_quantity(1, 2);
          cart_B._from_json(cart_A.to_json(), STORAGETTL);
          assert_eq(0, cart_B.items[0].quantity, "1st item non-empty");
          assert_eq(2, cart_B.items[1].quantity, "2st item non-empty");
          assert_eq(2, cart_B.total_quantity, "non-empty total quantity");
          assert_eq(4, cart_B.total_price, "non-empty total price");
          assert_eq(2, cart_B.total_price_off, "non-empty total price_off");

          cart_A.set_quantity(0, 2);
          cart_A.set_quantity(1, 4);

          cart_B._from_json(cart_A.to_json(), 1);
          assert_eq(0, cart_B.items[0].quantity, "1st item expired");
          assert_eq(0, cart_B.items[1].quantity, "2st item expired");
          assert_eq(0, cart_B.total_quantity, "expired total quantity");
          assert_eq(0, cart_B.total_price, "expired total price");
          assert_eq(0, cart_B.total_price_off, "expired total price_off");

          cart_A.items[0].id = 2; // hack, delete item 0 and create a new item 2

          cart_B._from_json(cart_A.to_json(), STORAGETTL);
          assert_eq(0, cart_B.items[0].quantity, "1st item load-no-mixed");
          assert_eq(4, cart_B.items[1].quantity, "2st item load-no-mixed");
          assert_eq(4, cart_B.total_quantity, "load-no-mixed total quantity");
          assert_eq(8, cart_B.total_price, "load-no-mixed total price");
          assert_eq(4, cart_B.total_price_off, "load-no-mixed total price_off");
          assert_eq(0, cart_B.items[0].id, "1st item id load-no-mixed");
          assert_eq(1, cart_B.items[1].id, "1st item id load-no-mixed");
          assert_eq(2, cart_B.items.length, "item list load-no-mixed");

          cart_B._from_json("", 1); // empty string
          cart_B._from_json("[", 1); // non-valid json
          cart_B._from_json("[]", 1);   // valid but not expected json
          assert_eq(0, cart_B.items[0].quantity, "1st item after load failed");
          assert_eq(0, cart_B.items[1].quantity, "2st item after load failed");
      })();

      (function storage() {
          var seed = [
              {id: 0, quantity: 0, desc: "foo", price: 1 },
              {id: 1, quantity: 0, desc: "foo", price: 2, price_off: 1 },
          ];

          // get a clone, Cart will grab this be reference and not
          // by value so we need to work with a copy
          var seed_clone = JSON.parse(JSON.stringify(seed));

          var cart_A = new Cart(seed, true);
          var cart_B = new Cart(seed_clone, true);

          cart_A.set_quantity(1, 2); // set a value

          cart_A._save();
          cart_A._restore();

          assert_eq(0, cart_A.items[0].quantity, "1st item save-restore");
          assert_eq(2, cart_A.items[1].quantity, "2st item save-restore");
          assert_eq(2, cart_A.total_quantity, "save-restore total quantity");
          assert_eq(4, cart_A.total_price, "save-restore total price");
          assert_eq(2, cart_A.total_price_off, "save-restore total price_off");

          cart_B.set_quantity(0, 5); // make it dirty

          cart_A._save();
          cart_B._restore(); // restore it in another cart

          assert_eq(0, cart_B.items[0].quantity, "1st item save-restore (aka transfer)");
          assert_eq(2, cart_B.items[1].quantity, "2st item save-restore (aka transfer)");
          assert_eq(2, cart_B.total_quantity, "save-restore (aka transfer) total quantity");
          assert_eq(4, cart_B.total_price, "save-restore (aka transfer) total price");
          assert_eq(2, cart_B.total_price_off, "save-restore (aka transfer) total price_off");

          cart_A.set_quantity(0, 2); // set a value
          cart_A.set_quantity(1, 4); // set a value
          cart_A._save();
          cart_A._save();
          cart_A._save();

          assert_eq(2, cart_A.items[0].quantity, "1st item multiple saves");
          assert_eq(4, cart_A.items[1].quantity, "2st item multiple saves");
          assert_eq(6, cart_A.total_quantity, "multiple saves total quantity");
          assert_eq(10, cart_A.total_price, "multiple saves total price");
          assert_eq(4, cart_A.total_price_off, "multiple saves total price_off");

          cart_B._restore();
          cart_B._restore();
          cart_B._restore();

          assert_eq(2, cart_B.items[0].quantity, "1st item multiple restores");
          assert_eq(4, cart_B.items[1].quantity, "2st item multiple restores");
          assert_eq(6, cart_B.total_quantity, "multiple restores total quantity");
          assert_eq(10, cart_B.total_price, "multiple restores total price");
          assert_eq(4, cart_B.total_price_off, "multiple restores total price_off");

          var seed_clone = JSON.parse(JSON.stringify(seed));
          var cart_C = new Cart(seed_clone, false);

          assert_eq(2, cart_C.items[0].quantity, "1st item auto restore");
          assert_eq(4, cart_C.items[1].quantity, "2st item auto restore");
          assert_eq(6, cart_C.total_quantity, "auto restore total quantity");
          assert_eq(10, cart_C.total_price, "auto restore total price");
          assert_eq(4, cart_C.total_price_off, "auto restore total price_off");

          delete sessionStorage[STORAGEKEY];
          cart_B._restore();

          assert_eq(0, cart_B.items[0].quantity, "1st item empty storage");
          assert_eq(0, cart_B.items[1].quantity, "2st item empty storage");
          assert_eq(0, cart_B.total_quantity, "empty storage total quantity");
          assert_eq(0, cart_B.total_price, "empty storage total price");
          assert_eq(0, cart_B.total_price_off, "empty storage total price_off");
      })();

  };


  exports.Cart = Cart;
  exports.test_cart = test;

})(this);
