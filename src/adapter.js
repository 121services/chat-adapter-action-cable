import ActionCable from 'actioncable';
import EventEmitter from 'events';

export default class ChatAdapterActionCable {
  constructor() {
    this._name = 'ChatAdapterActionCable';
    this._eventBus = new EventEmitter();
  }

  get name() {
    return this._name;
  }

  get subscriber() {
    return this._subscriber;
  }

  init(config) {
    var url;

    this._backendUrl = config.backendUrl;
    // TODO *adapter.init json object to send to backend as initialization result will fire a ChatAdapter::onInit event
    this._initData = config.initData;
    // config.init.endpoint
    // config.init.method
    // config.init.data

    url = this._backendUrl + this._initData.endpoint;
    let self = this;

    return new Promise(function (resolve, reject) {
      fetch(url, {
        method: self._initData.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(self._initData.data)
      }).then(response => {
        if (response.ok) {
          response.json().then(json => {
            if (json.wss_url === undefined || json.wss_url === '') {
              reject(`${url} did not provide a valid wss_url to open ActionCable web sockets`);
            }

            if (json.wss_channel_name === undefined || json.wss_channel_name === '') {
              reject(`${url} did not provide a valid wss_channel_name for ActionCable use`);
            }

            if (json.wss_channel_id === undefined || json.wss_channel_id === '') {
              reject(`${url} did not provide a valid wss_channel_id for ActionCable use`);
            }

            self._cable = ActionCable.createConsumer(json.wss_url);
            self._subscriber = self.addChannelSubscriber(json.wss_channel_name, json.wss_channel_id);

            resolve(json);
          });
        } else {
          reject('HTTP error: ' + response.status);
        }
      }).catch(error => {
        reject(error.message);
      });
    });
  }

  addChannelSubscriber(channelId, userId) {
    var self = this;

    return this._cable.subscriptions.create({channel: channelId, userId: userId}, {
      received(data) {
        self._eventBus.emit('ucw:newRemoteMessage', data);
      },
      // Called when the subscription is ready for use on the server
      connected() {
        console.debug('channel connected');
      },

      // Called when the WebSocket connection is closed
      disconnected() {
        console.debug('channel disconnected');
      },

      // Called when the subscription is rejected by the server
      rejected() {
        console.debug('channel rejected');
      }
    });
  }

  on(event, callback) {
    this._eventBus.on(event, callback);
  }
}
