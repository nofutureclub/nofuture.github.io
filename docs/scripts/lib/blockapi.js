window.blockapi = {
  async read(contract, method, ...args) {
    return await contract.methods[method](...args).call()
  },

  async write(contract, account, method, value, ...args) {
    const params = {
      to: contract.address,
      from: account,
      data: contract.methods[method](...args).encodeABI(),
    }
    
    if (value) params.value = String(this.web3().utils.toHex(value))
    
    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [params]
    })
  },

  async estimateGas(contract, account, gasLimit, method, value, ...args) {
    const params  = { from: account, gas: gasLimit }
    if (value) params.value = value
    const rpc = contract.methods[method](...args)
    return await rpc.estimateGas(params)
  },

  send(contract, account, method, value, ...args) {
    const params = {
      to: contract.address,
      from: account
    }
    if (value) params.value = String(this.web3().utils.toHex(value))
    const rpc = contract.methods[method](...args)
    return rpc.send(params)
  },

  watch(blockmetadata, address, type, symbol, decimals, image) {
    this.connect(blockmetadata, async () => {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type,
          options: {
            address: address, // The address that the token is at.
            symbol: symbol, // A ticker symbol or shorthand, up to 5 chars.
            decimals: decimals, // The number of decimals in the token
            image: image, // A string url of the token logo
          },
        },
      })
    }, () => {})
  },

  toEther(num, format) {
    const libWeb3 = this.web3()
    if (format === 'string') {
      return libWeb3.utils.fromWei(String(num)).toString()
    } else if (format === 'comma') {
      return libWeb3.utils.fromWei(String(num)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else if (format === 'int') {
      return parseFloat(libWeb3.utils.fromWei(String(num)).toString());
    }
    return libWeb3.utils.fromWei(String(num))
  },

  toWei(num) {
    return this.web3().utils.toWei(String(num)).toString()
  },

  web3() {
    if (typeof window._web3 === 'undefined') {
      window._web3 = new Web3(window.ethereum)
    }

    return window._web3
  },

  contract(name) {
    const libWeb3 = this.web3()
    return new libWeb3.eth.Contract(
      blockmetadata.contracts[name].abi,
      blockmetadata.contracts[name].address
    )
  },

  async getWalletAddress() {
    return (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0]
  },

  async addNetwork({ chain_id, chain_name, chain_symbol, chain_uri, chain_scan }) {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{ 
        chainId: `0x${chain_id.toString(16)}`, 
        chainName: chain_name,
        rpcUrls:[ chain_uri ],                   
        blockExplorerUrls:[ chain_scan ],  
        nativeCurrency: { 
          symbol: chain_symbol,   
          decimals: 18
        }        
      }]
    })
  },

  async switchNetwork({ chain_id }) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chain_id.toString(16)}` }],
    });
  },

  async inNetwork(blockmetadata) {
    if (!(window.ethereum?.request)) {
      return false
    }
    
    const networkId = await window.ethereum.request({ method: 'net_version' });
    return networkId == blockmetadata.chain_id
  },

  async isConnected(blockmetadata) {
    if (!(window.ethereum?.request)) return false

    if (!(await this.inNetwork(blockmetadata))) return false
    const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    return !!accounts.length
  },

  async startSession(blockmetadata, connected, disconnected, listen) {
    if (listen) this.listenToWallet(blockmetadata, connected, disconnected)
    if (await this.isConnected(blockmetadata)) {
      const account = (await window.ethereum.request({ method: 'eth_accounts' }))[0]
      return connected(await this._getState(account), true)
    }
    return disconnected(null, true)
  },

  listenToWallet(blockmetadata, connected, disconnected) {
    if (window.ethereum?.isMetaMask && typeof window.__blockAPIListening === 'undefined') {
      //window.ethereum.on('connect', validate.bind(null, 'connect'))
      window.ethereum.on('disconnect', disconnected)
      window.ethereum.on('chainChanged', async (params) => {
        if (blockmetadata.chain_id !== parseInt(params, 16)) {
          return disconnected()
        }
        if (!this.isConnected(blockmetadata)) {
          await connect(blockmetadata, connected, disconnected)
        }

      })
      window.ethereum.on('accountsChanged', async (params) => {
        if (!Array.isArray(params) || params.length === 0) {
          return disconnected()
        }
        if (!this.isConnected(blockmetadata)) {
          await connect(blockmetadata, connected, disconnected)
        }
      })
      window.__blockAPIListening = true
    }

    return this
  },

  async connect(blockmetadata, connected, disconnected) {
    if (!window.ethereum?.isMetaMask) {
      return disconnected({ 
        connected: false, 
        message: 'Please install <a href="https://metamask.io/" target="_blank">MetaMask</a> and refresh this page.' 
      })
    }

    try {//matching network and connecting
      const account = await this.getWalletAddress()
      const networkId = await window.ethereum.request({ method: 'net_version' });
      if (networkId == blockmetadata.chain_id) {
        return connected(await this._getState(account))
      }
    } catch (e) {
      return disconnected(e)
    }

    try {//auto switch network, then matching network and connecting
      await this.switchNetwork(blockmetadata)
      const account = await this.getWalletAddress()
      const networkId = await window.ethereum.request({ method: 'net_version' });
      if (networkId == blockmetadata.chain_id) {
        return connected(await this._getState(account))
      }
    } catch (e) {
      return disconnected(e)
    }

    try {//adding network, auto switch network, then matching network and connecting
      await this.addNetwork(blockmetadata)
      await this.switchNetwork(blockmetadata)
      const account = await this.getWalletAddress()
      const networkId = await window.ethereum.request({ method: 'net_version' });
      if (networkId == blockmetadata.chain_id) {
        return connected(await this._getState(account))
      }
    } catch (e) {
      return disconnected(e)
    }
    
    return disconnected(e)
  },

  async _getState(account) {
    const libWeb3 = this.web3()
    const state = { account }
    if (Array.isArray(blockmetadata.contract?.abi)
      && typeof blockmetadata.contract?.address === 'string'
    ) {
      state.contract = new libWeb3.eth.Contract(
        blockmetadata.contract.abi,
        blockmetadata.contract.address
      )
    }

    if (typeof blockmetadata.contracts === 'object') {
      for (const key in blockmetadata.contracts) {
        if (Array.isArray(blockmetadata.contracts[key]?.abi)
          && typeof blockmetadata.contracts[key]?.address === 'string'
        ) {
          state[key] = new libWeb3.eth.Contract(
            blockmetadata.contracts[key].abi,
            blockmetadata.contracts[key].address
          )
        }
      }
    }

    return state
  }
}