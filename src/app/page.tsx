"use client";

import Image from "next/image";
import { metaMask } from "wagmi/connectors";
import { useAccount, useConnect, useDisconnect, useSendCalls, useSwitchChain } from "wagmi";
import { useState, useRef, useEffect } from "react";
import { getCallsStatus } from "@wagmi/core";
import { wagmiConfig as config } from "@/providers/AppProvider";
import { parseEther } from "viem";
import AssetChecker from "@/components/AssetChecker";
import { useChainId } from "wagmi";
import { mainnet, polygon, bsc, arbitrum, base, sepolia } from "viem/chains";

// 支持的链配置
const SUPPORTED_CHAINS = [
  { id: mainnet.id, name: 'Ethereum', logo: '/ethereum-logo.svg' },
  { id: polygon.id, name: 'Polygon', logo: '/polygon-logo.svg' }, 
  { id: bsc.id, name: 'BSC', logo: '/bnb-logo.svg' },
  { id: arbitrum.id, name: 'Arbitrum', logo: '/arbitrum-logo.svg' },
  { id: base.id, name: 'Base', logo: '/base-logo.svg' },
  { id: sepolia.id, name: 'Sepolia', logo: '/ethereum2-logo.svg' },
];

// Chain ID to chain name mapping
const CHAIN_NAMES = {
  1: 'Ethereum',
  137: 'Polygon',
  56: 'Binance Smart Chain',
  42161: 'Arbitrum',
  8453: 'Base',
  11155111: 'Sepolia'
};

// Get native currency name based on chain ID
function getNativeCurrencyName(chainId: number | undefined): string {
  if (!chainId) return 'ETH';
  switch (chainId) {
    case 56: // BSC
      return 'BNB';
    case 137: // Polygon
      return 'POL';
    default:
      return 'ETH';
  }
}

// 根据链ID获取区块浏览器链接
function getExplorerUrl(chainId: number, txHash: string): string {
  const explorerUrls = {
    1: `https://etherscan.io/tx/${txHash}`, // Ethereum
    137: `https://polygonscan.com/tx/${txHash}`, // Polygon
    56: `https://bscscan.com/tx/${txHash}`, // BSC
    42161: `https://arbiscan.io/tx/${txHash}`, // Arbitrum
    8453: `https://basescan.org/tx/${txHash}`, // Base
    11155111: `https://sepolia.etherscan.io/tx/${txHash}`, // Sepolia
  };
  return explorerUrls[chainId as keyof typeof explorerUrls] || `https://etherscan.io/tx/${txHash}`;
}

// Language type
type Language = 'zh' | 'en';

// Text mapping
const texts = {
  zh: {
    title: '钱包清道夫',
    subtitle: '基于MetaMask智能账户的批量交易功能，一键转移钱包内的所有资产（原生代币+ERC20代币）',
    connectWallet: '连接钱包',
    disconnect: '断开连接',
    executeBatchTransaction: '执行批量交易',
    transactions: '笔交易',
    exceededLimit: '（⚠️ 超出限制）',
    notGenerated: '(未生成)',
    noTransactionData: '📋 暂无交易数据',
    queryAssetsFirst: '请先查询资产并生成批量转账数据',
    willSend: '将发送',
    transactionsFromAssets: '笔交易 (从资产列表中生成，已过滤掉会回滚的交易)',
    totalTransactions: '共',
    onlyFirstTen: '笔，仅执行前 10 笔',
    sendBatchTransaction: '发送批量交易',
    sendingTransaction: '⌛ 正在发送交易...',
    transactionSubmitted: '交易已成功提交！',
    dataId: 'Data ID:',
    transactionCount: '交易数量:',
    original: '原',
    actuallySent: '笔，实际发送',
    checkingStatus: 'Checking Status...',
    checkStatus: '🔍 检查交易状态',
    statusCheckError: 'Status Check Error',
    transactionConfirmed: '✅ 交易已确认！🎉',
    viewOnExplorer: 'View on Explorer:',
    transactionError: 'Transaction Error',
    tutorial: 'Tutorial',
    github: 'GitHub',
    switchToEnglish: 'English',
    switchToChinese: '中文',
    connectedTo: '已连接到',
    queryAssetsAndGenerate: '⚠️ 请先查询资产并生成批量转账数据',
    total: '共',
    onlyFirstTenExecuted: '笔，仅执行前 10 笔',
    totalAmount: '✪ Total Amount:',
    transactionPending: '交易提交中...',
    switchChainFailed: '切换网络失败:',
    ensureNetworkAdded: '请确保目标网络已添加到 MetaMask。',
    eip7702Limit: '交易笔数限制',
    maxTenTransactions: '• 每次批量交易最多支持 10 笔',
    excessNotExecuted: '• 超出限制的交易不会被执行',
    suggestBatchProcessing: '• 建议分批处理大量资产',
    share: '分享',
    tweet: '推文',
    copy: '复制',
    nativeTransfer: 'Native Transfer',
    erc20Transfer: 'ERC20 Transfer',
    // Header/status and network info
    networkInfoTitle: '网络信息',
    networkChangedPrompt: '网络已切换',
    currentChainLabel: '当前链',
    unknownChain: '未知链',
    chainIdLabel: '链ID',
    addressLabel: '地址',
    notConnected: '未连接钱包',
    pleaseConnectWallet: '请先连接钱包以使用本功能',
    mobileConnectHint: '在移动设备上，请确保已安装 MetaMask 移动应用并在应用内浏览器中打开此页面',
    mobileConnectGuide: '移动端连接步骤：1) 打开 MetaMask 应用 2) 点击底部"浏览器"标签 3) 在此浏览器中打开本页面 4) 然后点击连接钱包',
    notInMetaMaskBrowser: '⚠️ 检测到您不在 MetaMask 应用内浏览器中。请在 MetaMask 应用中打开此页面以确保连接正常。',
    tryReconnect: '如果返回页面后未连接，请点击下方按钮重新连接',
    tweetTitle: '【钱包清道夫】',
    tweetText: '基于MetaMask智能账户的批量交易功能，一键转移钱包内的所有资产（原生代币+ERC20代币）',
    shareTitle: '钱包清道夫',
    smartAccountError: '需要关闭智能账户功能',
    smartAccountErrorDesc: '检测到账户已升级为不支持的合约版本。请按照以下步骤操作：',
    solutionSteps: '解决步骤：',
    openMetaMask: '打开 MetaMask 钱包',
    clickAccountIcon: '点击右上角 "☰"',
    selectAccountDetails: '选择 "账户详情"',
    findSmartAccount: '设置 "智能账户"',
    clickDisableSmartAccount: '关闭相关链的智能账户（需支付Gas费）',
    returnAndRetry: '返回此页面重新尝试批量交易',
  },
  en: {
    title: 'Wallet Scavenger',
    subtitle: 'Powered by MetaMask Smart Account, transfer your all assets (Native + ERC20) with one click',
    connectWallet: 'Connect Wallet',
    disconnect: 'Disconnect',
    executeBatchTransaction: 'Execute Batch Transaction',
    transactions: ' transactions',
    exceededLimit: ' (⚠️ Exceeded limit)',
    notGenerated: '(Not generated)',
    noTransactionData: '📋 No transaction data',
    queryAssetsFirst: 'Please query assets and generate batch transfer data first',
    willSend: 'Will send',
    transactionsFromAssets: ' transactions (generated from asset list, transactions that will be rolled back have been filtered.)',
    totalTransactions: 'Total',
    onlyFirstTen: ' transactions, only first 10 executed',
    sendBatchTransaction: 'Send Batch Transaction',
    sendingTransaction: '⌛ Sending transaction...',
    transactionSubmitted: 'Transaction submitted successfully!',
    dataId: 'Data ID:',
    transactionCount: 'Transaction count:',
    original: 'Original',
    actuallySent: ' transactions, actually sent',
    checkingStatus: 'Checking Status...',
    checkStatus: '🔍 Check Transaction Status',
    statusCheckError: 'Status Check Error',
    transactionConfirmed: '✅ Transaction Confirmed! 🎉',
    viewOnExplorer: 'View on Explorer:',
    transactionError: 'Transaction Error',
    tutorial: 'Tutorial',
    github: 'GitHub',
    switchToEnglish: 'English',
    switchToChinese: '中文',
    connectedTo: 'Connected to',
    queryAssetsAndGenerate: '⚠️ Please query assets and generate batch transfer data first',
    total: 'Total',
    onlyFirstTenExecuted: ' transactions, only first 10 executed',
    totalAmount: '✪ Total Amount:',
    transactionPending: 'Transaction submitting...',
    switchChainFailed: 'Switch network failed:',
    ensureNetworkAdded: 'Please ensure the target network has been added to MetaMask.',
    eip7702Limit: 'Transaction Limit',
    maxTenTransactions: '• Maximum 10 transactions per batch',
    excessNotExecuted: '• Transactions exceeding the limit will not be executed',
    suggestBatchProcessing: '• Suggest processing large assets in batches',
    share: 'Share',
    tweet: 'Tweet',
    copy: 'Copy',
    nativeTransfer: 'Native Transfer',
    erc20Transfer: 'ERC20 Transfer',
    // Header/status and network info
    networkInfoTitle: 'Network Info',
    networkChangedPrompt: 'Network switched',
    currentChainLabel: 'Current chain',
    unknownChain: 'Unknown chain',
    chainIdLabel: 'Chain ID',
    addressLabel: 'Address',
    notConnected: 'Not Connected',
    pleaseConnectWallet: 'Please connect your wallet first to use this feature',
    mobileConnectHint: 'On mobile devices, please ensure MetaMask mobile app is installed and open this page in the in-app browser',
    mobileConnectGuide: 'Mobile connection steps: 1) Open MetaMask app 2) Tap the "Browser" tab at the bottom 3) Open this page in that browser 4) Then click connect wallet',
    notInMetaMaskBrowser: '⚠️ Detected you are not in MetaMask in-app browser. Please open this page in MetaMask app to ensure proper connection.',
    tryReconnect: 'If not connected after returning, please click the button below to reconnect',
    tweetTitle: '【Wallet Scavenger】',
    tweetText: 'Batch transaction feature powered by MetaMask Smart Account, transfer your all assets (Native + ERC20) with one click',
    shareTitle: 'Wallet Scavenger',
    smartAccountError: 'Need to disable smart account feature',
    smartAccountErrorDesc: 'Detected that the account has been upgraded to an unsupported contract version. Please follow these steps:',
    solutionSteps: 'Solution Steps:',
    openMetaMask: 'Open MetaMask wallet',
    clickAccountIcon: 'Click the "☰" in the top right corner',
    selectAccountDetails: 'Select "Account Details"',
    findSmartAccount: 'Set up "Smart Account"',
    clickDisableSmartAccount: 'Close the smart account related to the chain (requires gas fee)',
    returnAndRetry: 'Return to this page and retry batch transactions',
  }
};

// Helper function to format transaction description based on current language
function formatTransactionDescription(transaction: any, language: Language): string {
  if (!transaction.description) return '';
  
  // For native_transfer, parse and reformat the description
  if (transaction.type === 'native_transfer') {
    // Match patterns like: "Transfer {amount} {symbol} (reserved {gasCost} for gas)"
    // or "Transfer {amount} {symbol} (预留 {gasCost} 作为gas费)"
    // Use more flexible pattern to match numbers with any decimal places
    const enPattern = /Transfer\s+([\d.]+(?:e[+-]?\d+)?)\s+(\S+?)\s+\(reserved\s+([\d.]+(?:e[+-]?\d+)?)\s+for\s+gas\)/i;
    const zhPattern = /Transfer\s+([\d.]+(?:e[+-]?\d+)?)\s+(\S+?)\s+\(预留\s+([\d.]+(?:e[+-]?\d+)?)\s+作为gas费\)/i;
    
    const enMatch = transaction.description.match(enPattern);
    const zhMatch = transaction.description.match(zhPattern);
    
    if (enMatch || zhMatch) {
      const match = enMatch || zhMatch;
      const amount = match[1];
      const symbol = match[2];
      const gasCost = match[3];
      
      const texts = language === 'zh' ? {
        nativeTransferDescription: 'Transfer {amount} {symbol} (预留 {gasCost} 作为gas费)'
      } : {
        nativeTransferDescription: 'Transfer {amount} {symbol} (reserved {gasCost} for gas)'
      };
      
      return texts.nativeTransferDescription
        .replace('{amount}', amount)
        .replace('{symbol}', symbol)
        .replace('{gasCost}', gasCost);
    }
  }
  
  // For ERC20 transfers, just return as is (already handled)
  return transaction.description;
}

// Helper function to extract gas cost from native transfer transaction
function extractGasCostFromTransactions(transactions: any[]): string | null {
  for (const tx of transactions) {
    if (tx.type === 'native_transfer' && tx.description) {
      const enPattern = /\(reserved\s+([\d.]+(?:e[+-]?\d+)?)\s+for\s+gas\)/i;
      const zhPattern = /\(预留\s+([\d.]+(?:e[+-]?\d+)?)\s+作为gas费\)/i;
      const enMatch = tx.description.match(enPattern);
      const zhMatch = tx.description.match(zhPattern);
      if (enMatch || zhMatch) {
        return (enMatch || zhMatch)[1];
      }
    }
  }
  return null;
}

// 检测是否为移动设备
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// 检测是否在 MetaMask 应用内浏览器
function isInMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.ethereum?.isMetaMask && window.ethereum?.isMetaMask);
}

export default function Home() {
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendCalls, error, isPending, isSuccess, data, reset } = useSendCalls();
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [transactionCounts, setTransactionCounts] = useState<{ original: number; sent: number } | null>(null);
  const [customTransactions, setCustomTransactions] = useState<any[]>([]);
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<{ total: number; valid: number; failed: number } | null>(null);
  const [networkChanged, setNetworkChanged] = useState(false);
  const [previousChainId, setPreviousChainId] = useState<number | null>(null);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [isMobile, setIsMobile] = useState(false);
  const [isInMetaMask, setIsInMetaMask] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = texts[language];
  
  // 检测设备类型
  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInMetaMask(isInMetaMaskBrowser());
  }, []);

  // 监听连接状态变化
  useEffect(() => {
    if (isConnected) {
      setConnecting(false);
      setStatusError(null);
      // 清除连接超时
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      console.log('连接状态更新：已连接');
    }
  }, [isConnected]);

  // 监听连接错误
  useEffect(() => {
    if (connectError && connecting && !isConnected) {
      setStatusError(
        language === 'zh'
          ? `连接失败: ${connectError.message}。如果从 MetaMask 返回后未连接，请重试。`
          : `Connection failed: ${connectError.message}. If not connected after returning from MetaMask, please try again.`
      );
      setConnecting(false);
    }
  }, [connectError, connecting, isConnected, language]);

  // 监听页面可见性变化，当页面重新获得焦点时检查连接状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && connecting) {
        // 页面重新可见且之前正在连接，检查是否已连接
        setTimeout(() => {
          if (window.ethereum?.selectedAddress) {
            // 检测到地址，尝试重新连接
            console.log('检测到页面重新获得焦点且有地址，尝试重新连接...');
            if (!isConnected) {
              // 如果 wagmi 还未连接，尝试重新连接
              try {
                connect({ connector: metaMask() });
              } catch (error) {
                console.error('重新连接异常:', error);
                setConnecting(false);
              }
            } else {
              setConnecting(false);
            }
          } else {
            setConnecting(false);
          }
        }, 1500); // 给 MetaMask 一些时间初始化
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isConnected, connecting, connect]);
  // 处理钱包连接
  const handleConnectWallet = async () => {
    try {
      setConnecting(true);
      setStatusError(null);
      
      // 移动端特殊处理
      if (isMobile && !isInMetaMask) {
        // 不在 MetaMask 应用内浏览器，提示用户
        setStatusError(
          language === 'zh' 
            ? '请在 MetaMask 应用的浏览器中打开此页面后再连接'
            : 'Please open this page in MetaMask app browser first'
        );
        setConnecting(false);
        return;
      }
      
      connect({ connector: metaMask() });
      
      // 清除之前的超时
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      // 设置超时，如果连接失败
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected) {
          setConnecting(false);
          // 如果在移动端且检测到 ethereum 地址，提示用户可能需要在应用内浏览器中打开
          if (isMobile && window.ethereum?.selectedAddress) {
            setStatusError(
              language === 'zh'
                ? '检测到钱包地址但未完成连接。请确保在 MetaMask 应用内浏览器中打开此页面，然后重试。'
                : 'Wallet address detected but connection incomplete. Please ensure you are in MetaMask in-app browser, then retry.'
            );
          } else {
            setStatusError(
              language === 'zh'
                ? '连接超时。如果从 MetaMask 返回后未连接，请重试。'
                : 'Connection timeout. If not connected after returning from MetaMask, please retry.'
            );
          }
        }
      }, 15000);
    } catch (error: any) {
      console.error('连接钱包异常:', error);
      setStatusError(
        language === 'zh'
          ? `连接异常: ${error?.message || '未知错误'}`
          : `Connection error: ${error?.message || 'Unknown error'}`
      );
      setConnecting(false);
    }
  };

  // 底部分享功能
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = t.shareTitle;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.log('分享被取消或失败:', err);
    }
  };

  const handleTweet = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = t.tweetTitle;
    const text = t.tweetText;
    const tweetContent = `${title}\n${text}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetContent)}&url=${encodeURIComponent(url)}`;
    if (typeof window !== 'undefined') {
      window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleSendTransaction = async () => {
    if (!isConnected) return;

    // Reset previous states
    setTransactionHash(null);
    setStatusError(null);
    setTransactionCounts(null);
    reset();

  // 只使用自定义交易；若为空则直接返回（按钮已禁用，无需提示）
  if (customTransactions.length === 0) {
    return;
  }
    
    let transactionsToUse = customTransactions;
    
    // EIP-7702 最多支持10笔交易，自动截取前10笔
    const MAX_BATCH_SIZE = 10;
    const truncatedTransactions = transactionsToUse.slice(0, MAX_BATCH_SIZE);
    
    const calls = truncatedTransactions.map(call => ({
      to: call.to as `0x${string}`,
      value: parseEther(call.value),
      ...(call.data && { data: call.data as `0x${string}` })
    }));
    
    console.log("⌛ Sending batch transaction with calls:", calls);
    console.log(`原交易数量: ${transactionsToUse.length}，实际发送: ${truncatedTransactions.length}`);

    // 保存交易数量信息用于显示
    setTransactionCounts({
      original: transactionsToUse.length,
      sent: truncatedTransactions.length
    });

    if (!chainId) {
      console.error("发送批量交易失败：缺少链 ID");
      setStatusError("当前网络信息缺失，请重新连接钱包后再试。");
      return;
    }

    sendCalls({
      chainId,
      calls,
    });
  };

  const handleGetCallsStatus = async () => {
    if (!data?.id) return;

    setStatusLoading(true);
    setStatusError(null);

    try {
      const status = await getCallsStatus(config, { id: data.id });
      console.log("Transaction status:", status);

      if (
        status.status === "success" &&
        status.receipts?.[0]?.transactionHash
      ) {
        setTransactionHash(status.receipts[0].transactionHash);
      } else if (status.status === "failure") {
        setStatusError("Transaction failed");
      }
    } catch (err) {
      console.error("Error getting call status:", err);
      setStatusError(
        err instanceof Error ? err.message : "Failed to get transaction status"
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const handleGenerateTransactions = (transactions: any[], precheckResult?: { total: number; valid: number; failed: number }) => {
    setCustomTransactions(transactions);
    setPrecheckResult(precheckResult || null);
    // 只生成交易配置，不自动下载
    console.log('Generated transactions:', transactions);
    if (precheckResult) {
      console.log('Pre-check result:', precheckResult);
    }
  };

  // Listen to chain changes
  useEffect(() => {
    if (chainId && previousChainId && chainId !== previousChainId) {
      // Chain has changed
      console.log('Network switched', { from: previousChainId, to: chainId });
      setTransactionHash(null);
      setStatusError(null);
      setStatusLoading(false);
      setNetworkChanged(true);
      // Hide network switch message after 3 seconds
      setTimeout(() => setNetworkChanged(false), 3000);
      // Clear all transaction data when network changes
      setCustomTransactions([]);
      setTransactionCounts(null);
      setPrecheckResult(null);
      // Reset wagmi transaction state
      reset();
    }
    setPreviousChainId(chainId);
  }, [chainId, previousChainId, reset]);

  const handleSwitchChain = async (targetChainId: number) => {
    // 如果已经在目标链上，直接关闭下拉菜单
    if (chainId === targetChainId) {
      setIsChainDropdownOpen(false);
      return;
    }

    try {
      setIsChainDropdownOpen(false);
      await switchChain({ chainId: targetChainId });
    } catch (error: any) {
      console.error('切换链失败:', error);
      // 显示错误信息
      setStatusError(`${t.switchChainFailed} ${error?.message || '未知错误'}。${t.ensureNetworkAdded}`);
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  return (
    <div className="font-sans min-h-screen">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <a
                href="https://docs.metamask.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity flex-shrink-0"
                title="MetaMask Documentation"
              >
                <Image
                  src="/mm.svg"
                  alt="MetaMask logo"
                  width={40}
                  height={40}
                  priority
                  className="w-8 h-8 sm:w-10 sm:h-10"
                />
              </a>
              <div className="flex flex-col min-w-0">
                <span className="text-base sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  {t.title}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                  {t.subtitle}
                </span>
              </div>
            </div>
            
            {/* 右侧按钮组 */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
              {/* 语言切换按钮 */}
              <button
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title={language === 'zh' ? t.switchToEnglish : t.switchToChinese}
              >
                <Image
                  src="/language.svg"
                  alt="Language"
                  width={25}
                  height={25}
                  className="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span className="hidden sm:inline">{language === 'zh' ? t.switchToEnglish : t.switchToChinese}</span>
              </button>

              {/* 链选择下拉菜单 */}
              {isConnected && (
                <div className="relative" ref={chainDropdownRef}>
                  {/* 下拉菜单触发器 */}
                  <button
                    onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[80px] sm:min-w-[120px] md:min-w-[140px]"
                  >
                    {chainId && (
                      <>
                        {(() => {
                          const currentChain = SUPPORTED_CHAINS.find(chain => chain.id === chainId);
                          if (currentChain?.logo) {
                            return (
                              <Image
                                src={currentChain.logo}
                                alt="Chain Logo"
                                width={16}
                                height={16}
                                className="w-3 h-3 sm:w-4 sm:h-4"
                              />
                            );
                          } else {
                            return (
                              <span className="text-xs sm:text-sm">
                                ⛓️
                              </span>
                            );
                          }
                        })()}
                        <span className="truncate">{SUPPORTED_CHAINS.find(chain => chain.id === chainId)?.name}</span>
                      </>
                    )}
                    <svg
                      className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${isChainDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 下拉菜单选项 */}
                  {isChainDropdownOpen && (
                    <div className="absolute top-full right-0 sm:left-0 mt-1 w-[180px] sm:w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
                      {SUPPORTED_CHAINS.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => handleSwitchChain(chain.id)}
                          className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2 text-xs sm:text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                            chainId === chain.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {chain.logo ? (
                            <Image
                              src={chain.logo}
                              alt={`${chain.name} Logo`}
                              width={16}
                              height={16}
                              className="w-3 h-3 sm:w-4 sm:h-4"
                            />
                          ) : (
                            <span className="text-xs sm:text-sm">
                              ⛓️
                            </span>
                          )}
                          <span className="flex-1">{chain.name}</span>
                          {chainId === chain.id && (
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* 钱包连接按钮 */}
              <button
                className={`flex items-center gap-1 sm:gap-2 rounded-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 ${
                  isConnected
                    ? "bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-300"
                    : "bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-300"
                }`}
                onClick={() => {
                  if (isConnected) {
                    disconnect();
                    setTransactionHash(null);
                    setStatusError(null);
                    setPrecheckResult(null);
                    reset();
                  } else {
                    handleConnectWallet();
                  }
                }}
              >
                <Image
                  src="/MetaMask-icon-fox.svg"
                  alt="MetaMask"
                  width={16}
                  height={16}
                  className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                />
                <span className="truncate">{isConnected ? t.disconnect : t.connectWallet}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="pt-16 sm:pt-20 pb-12 sm:pb-20 px-4 sm:px-6 md:px-8 lg:px-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-6 md:gap-8">
        {/* 未连接钱包提示 */}
        {!isConnected && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 sm:p-6">
            <div className="text-center">
              <div className="mb-4">
                <Image
                  src="/MetaMask-icon-fox.svg"
                  alt="MetaMask"
                  width={64}
                  height={64}
                  className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3"
                />
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                  {t.notConnected}
                </h2>
                <p className="text-sm sm:text-base text-blue-700 dark:text-blue-300 mb-4">
                  {t.pleaseConnectWallet}
                </p>
                {/* 移动端提示 */}
                {isMobile && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                    {!isInMetaMask ? (
                      <>
                        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 font-semibold mb-2">
                          {t.notInMetaMaskBrowser}
                        </p>
                        <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                          {t.mobileConnectGuide}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                        ✅ {language === 'zh' ? '检测到您在 MetaMask 应用内浏览器中，可以安全连接' : 'Detected you are in MetaMask in-app browser, safe to connect'}
                      </p>
                    )}
                  </div>
                )}
                {connecting && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">{language === 'zh' ? '正在连接...' : 'Connecting...'}</span>
                  </div>
                )}
                {statusError && !isConnected && !connecting && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 break-words">
                      {statusError}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-2">
                      {t.tryReconnect}
                    </p>
                  </div>
                )}
              </div>
              <button
                className={`w-full sm:w-auto min-w-[200px] min-h-[48px] sm:min-h-[52px] font-semibold text-base sm:text-lg rounded-lg px-6 sm:px-8 py-3 sm:py-3.5 transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-3 mx-auto ${
                  connecting || (isMobile && !isInMetaMask)
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                }`}
                onClick={handleConnectWallet}
                disabled={connecting || (isMobile && !isInMetaMask)}
              >
                <Image
                  src="/MetaMask-icon-fox.svg"
                  alt="MetaMask"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span>
                  {connecting 
                    ? (language === 'zh' ? '连接中...' : 'Connecting...')
                    : t.connectWallet
                  }
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 钱包状态显示 */}
        {isConnected && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
              <span className="font-medium text-sm sm:text-base break-all">🔗 {t.connectedTo} {address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
          </div>
        )}

        {/* Network information section */}
        {isConnected && chainId && (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 rounded-lg w-full">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">🌐 {t.networkInfoTitle}</h2>
            
            {/* 网络切换提示 */}
            {networkChanged && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 text-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="font-medium text-xs sm:text-sm">{t.networkChangedPrompt}</span>
                </div>
              </div>
            )}

            {/* 链信息显示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-blue-800 space-y-2">
                <div className="font-medium flex items-center gap-2 break-words">
                  <Image src="/blockchain2.svg" alt="Chain" width={16} height={16} className="flex-shrink-0" />
                  <span>{t.currentChainLabel}: {CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES] || `${t.unknownChain} (${chainId})`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image src="/id.svg" alt="Chain ID" width={16} height={16} className="flex-shrink-0" />
                  <span>{t.chainIdLabel}: {chainId}</span>
                </div>
                {address && (
                  <div className="flex items-start gap-2 break-all">
                    <Image src="/address.svg" alt="Address" width={16} height={16} className="flex-shrink-0 mt-0.5" />
                    <span>{t.addressLabel}: {address.slice(0, 6)}...{address.slice(-4)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Asset Checker Section */}
        <AssetChecker onGenerateTransactions={handleGenerateTransactions} language={language} />

        {/* Batch transaction section */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 rounded-lg w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Image src="/run.svg" alt="Execute" width={24} height={24} className="w-5 h-5 sm:w-6 sm:h-6" />
              {t.executeBatchTransaction}
            </h2>
            {(() => {
              const transactionsToUse = customTransactions;
              const MAX_BATCH_SIZE = 10;
              const isOverLimit = transactionsToUse.length > MAX_BATCH_SIZE;
              return (
                <div className="relative group">
                  <div className={`text-[9px] sm:text-[10px] font-medium px-2 sm:px-3 py-1 rounded inline-flex items-center gap-1 sm:gap-2 ${
                    isOverLimit 
                      ? 'bg-red-100 text-red-700 border border-red-300' 
                      : transactionsToUse.length > 0
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-300'
                  }`}>
                    <span className="whitespace-nowrap">{transactionsToUse.length}{t.transactions}</span>
                    {isOverLimit && <span className="whitespace-nowrap hidden sm:inline">{t.exceededLimit}</span>}
                    {transactionsToUse.length === 0 && <span className="whitespace-nowrap hidden sm:inline">{t.notGenerated}</span>}
                    <svg 
                      className="w-3 h-3 sm:w-4 sm:h-4 cursor-help opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  {/* 隐藏的批注说明 */}
                  <div className="absolute right-0 sm:left-0 top-full mt-2 w-56 sm:w-64 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="font-semibold mb-1">{t.eip7702Limit}</div>
                    <div className="text-gray-300 space-y-1 text-[10px] sm:text-xs">
                      <p>{t.maxTenTransactions}</p>
                      <p>{t.excessNotExecuted}</p>
                      <p>{t.suggestBatchProcessing}</p>
                    </div>
                    {/* 小三角箭头 */}
                    <div className="absolute -top-2 right-4 sm:left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Transaction details */}
          {(() => {
            const transactionsToUse = customTransactions;
            
            if (transactionsToUse.length === 0) {
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg py-3 sm:py-4 px-4 sm:px-6 md:px-8 mb-4">
                  <div className="text-xs sm:text-sm text-gray-600 text-center">
                    <p className="mb-2">{t.noTransactionData}</p>
                    <p className="text-[10px] sm:text-xs">{t.queryAssetsAndGenerate}</p>
                  </div>
                </div>
              );
            }
            
            const MAX_BATCH_SIZE = 10;
            const displayedTransactions = transactionsToUse.slice(0, MAX_BATCH_SIZE);
            const wasTruncated = transactionsToUse.length > MAX_BATCH_SIZE;
            
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg py-3 sm:py-4 px-4 sm:px-6 md:px-8 mb-4">
                {/* 预检结果显示 */}
                {precheckResult && (
                  <div className={`mb-3 px-3 py-2 rounded-lg border text-[12px] ${
                    precheckResult.failed === 0
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : precheckResult.valid > 0
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    {precheckResult.failed === 0 ? (
                      <span className="text-green-700 dark:text-green-700 font-medium">✅ {language === 'zh' ? '预检完成' : 'Pre-check Complete'}: {precheckResult.total}/{precheckResult.total} {language === 'zh' ? '笔通过' : 'passed'}</span>
                    ) : precheckResult.valid > 0 ? (
                      <span className="text-green-700 dark:text-green-700 font-medium">ℹ️ {language === 'zh' ? '预检结果' : 'Pre-check Result'}: {precheckResult.valid}/{precheckResult.total} {language === 'zh' ? '笔通过' : 'passed'}, {precheckResult.failed} {language === 'zh' ? '笔回滚' : 'rolled back'}</span>
                    ) : (
                      <span className="text-red-700 dark:text-red-400 font-medium">❌ {language === 'zh' ? '预检失败' : 'Pre-check Failed'}: {precheckResult.failed}/{precheckResult.total} {language === 'zh' ? '笔失败' : 'failed'}</span>
                    )}
                  </div>
                )}
                <h3 className="text-[10px] sm:text-xs font-medium text-blue-800 mb-2 break-words">
                  {t.willSend} <span className="text-purple-800 dark:text-purple-800">{displayedTransactions.length} </span>{t.transactionsFromAssets}
                  {wasTruncated && <span className="text-orange-600 text-[9px] sm:text-[10px] ml-1 sm:ml-2 block sm:inline">⚠️ {t.total} {transactionsToUse.length}{t.onlyFirstTenExecuted}</span>}
                </h3>
                <ul className="text-[10px] sm:text-xs text-blue-700 space-y-1.5 sm:space-y-1 mb-3">
                  {displayedTransactions.map((transaction, index) => (
                    <li key={index} className="flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-1 sm:gap-2 flex-wrap">
                          {transaction.type === 'native_transfer' && (
                            <>
                              <Image src="/ethereum3.svg" alt="Native Transfer" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs">{t.nativeTransfer}</span>
                            </>
                          )}
                          {transaction.type === 'erc20_transfer' && (
                            <>
                              <Image src="/coins.svg" alt="ERC20 Transfer" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs">{t.erc20Transfer}</span>
                            </>
                          )}
                        </div>
                        {transaction.description && (
                          <div className="text-[9px] sm:text-[10px] text-blue-600 break-words mt-0.5">
                            {formatTransactionDescription(transaction, language)}
                          </div>
                        )}
                        <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1 break-all">
                          {transaction.type !== 'native_transfer' && (
                            <>To: {transaction.to.slice(0, 6)}...{transaction.to.slice(-4)}</>
                          )}
                          {transaction.value !== "0" && ` Value: ${transaction.value} ${getNativeCurrencyName(chainId)}`}
                          {transaction.data && ` | Data: ${transaction.data.slice(0, 10)}...`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="text-[10px] sm:text-xs font-medium text-purple-800 border-t border-purple-400 pt-2 break-words">
                {t.totalAmount} {displayedTransactions.reduce((total, tx) => total + parseFloat(tx.value), 0)} {getNativeCurrencyName(chainId)}
                </div>
                {/* Gas费保留提醒 */}
                {(() => {
                  const gasCost = extractGasCostFromTransactions(displayedTransactions);
                  return gasCost ? (
                    <div className="mt-2 bg-orange-800 border border-orange-600 rounded px-2 sm:px-3 py-1 sm:py-1.5">
                      <div className="flex items-start gap-2">
                        <div className="text-sm sm:text-base flex-shrink-0">💡</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-orange-100 font-medium mb-1.5 break-words">
                            {language === 'zh' ? '须知：' : 'Notice:'}
                          </p>
                          <ul className="text-[10px] sm:text-xs text-orange-100 space-y-1 list-none">
                            <li className="flex items-start gap-1.5">
                              <span className="flex-shrink-0">-</span>
                              <span className="break-words">
                                {language === 'zh' 
                                  ? <>已预留 <span className="text-green-500 font-medium">{gasCost} {getNativeCurrencyName(chainId)}</span> 用于支付Gas费</>
                                  : <>Reserved <span className="text-green-500 font-medium">{gasCost} {getNativeCurrencyName(chainId)}</span> for gas fees</>}
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="flex-shrink-0">-</span>
                              <span className="break-words">
                                {language === 'zh' 
                                  ? 'Metamask 钱包须启用智能账户，如果尚未启用将会自动弹窗提示启用'
                                  : 'MetaMask wallet must have smart account enabled. If not enabled, a popup will automatically prompt you to enable it'}
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="flex-shrink-0">-</span>
                              <span className="break-words">
                                {language === 'zh' 
                                  ? '批量交易将在同一笔交易中原子执行，只需花费1次Gas费，任何步骤失败，整个交易回滚'
                                  : 'Batch transactions will be executed atomically in a single transaction, requiring only 1 gas fee payment. If any step fails, the entire transaction will be rolled back'}
                              </span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="flex-shrink-0">-</span>
                              <span className="break-words">
                                {language === 'zh' 
                                  ? '点击 "发送批量交易"后，可在 MetaMask 钱包中查看交易详情（包括Gas费估算和交易明细）'
                                  : 'After clicking "Send Batch Transaction", you can view transaction details in MetaMask wallet (including gas fee estimation and transaction details)'}
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })()}

          {/* Send batch transaction button */}
          <button
            className={`w-full rounded-lg border border-solid px-4 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors mb-4 text-sm sm:text-base ${
              !isConnected || isPending || customTransactions.length === 0
                ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-green-700 hover:bg-green-800 text-yellow-300 border-green-800 cursor-pointer"
            }`}
            onClick={handleSendTransaction}
            disabled={!isConnected || isPending || customTransactions.length === 0}
          >
            <div className="flex items-center gap-2 justify-center">
              <Image src="/send.svg" alt="Send" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="break-words text-center">{isPending ? t.sendingTransaction : t.sendBatchTransaction}</span>
            </div>
          </button>

          {/* Transaction state */}
          {isPending && (
            <div className="flex items-center gap-2 text-blue-600 mb-4 text-sm sm:text-base">
              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <span>{t.transactionPending}</span>
            </div>
          )}

          {isSuccess && data && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">
                  {t.transactionSubmitted}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 break-words">
                <p className="break-all">
                  {t.dataId}{" "}
                  <code className="px-1 rounded break-all">{data.id}</code>
                </p>
                {transactionCounts && (
                  <p className="mt-2 break-words">
                    {t.transactionCount} {t.original} {transactionCounts.original}{t.actuallySent} <span className="text-purple-800 dark:text-purple-400 font-medium">{transactionCounts.sent}</span>{t.transactions}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4">
              <div className="text-red-700 font-medium text-sm sm:text-base">{t.transactionError}</div>
              <div className="text-xs sm:text-sm text-red-600 mt-1 break-words">{error.message}</div>
              
              {/* 检测智能账户错误 */}
              {error.message?.includes('Account upgraded to unsupported contract') && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="text-lg sm:text-xl flex-shrink-0">⚠️</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm text-orange-800 mb-2">
                        {t.smartAccountError}
                      </div>
                      <div className="text-[10px] sm:text-xs text-orange-700 mb-3 break-words">
                        {t.smartAccountErrorDesc}
                      </div>
                      <div className="text-[10px] sm:text-xs text-orange-700 break-words">
                        <strong>{t.solutionSteps}</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1 sm:space-y-2 ml-1 sm:ml-2">
                          <li className="break-words">{t.openMetaMask}</li>
                          <li className="break-words">{t.clickAccountIcon}</li>
                          <li className="break-words">{t.selectAccountDetails}</li>
                          <li className="break-words">{t.findSmartAccount}</li>
                          <li className="break-words">{t.clickDisableSmartAccount}</li>
                          <li className="break-words">{t.returnAndRetry}</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Check transaction status button */}
          {data && (
            <button
              className={`w-full rounded-lg border border-solid px-4 sm:px-6 py-2.5 sm:py-3 font-medium transition-colors text-sm sm:text-base ${
                statusLoading
                  ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                  : "bg-green-700 hover:bg-green-800 text-yellow-300 border-green-800 cursor-pointer"
              }`}
              onClick={handleGetCallsStatus}
              disabled={statusLoading || !data.id}
            >
              {statusLoading
                ? t.checkingStatus
                : t.checkStatus}
            </button>
          )}

          {/* Status error - 只在未连接时显示 */}
          {statusError && !isConnected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mt-4">
              <div className="text-red-700 font-medium text-sm sm:text-base">{t.statusCheckError}</div>
              <div className="text-xs sm:text-sm text-red-600 mt-1 break-words">{statusError}</div>
            </div>
          )}

          {/* Transaction hash */}
          {transactionHash && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mt-4">
              <div className="text-green-700 font-medium mb-2 text-sm sm:text-base">
                {t.transactionConfirmed}
              </div>
              <div className="text-xs sm:text-sm">
                <a
                  href={getExplorerUrl(chainId, transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                >
                  {t.viewOnExplorer} {transactionHash}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 删除了 Next.js 默认底部按钮（Deploy now / Read our docs） */}
        </div>
      </main>
      {/* 底部导航栏 */}
      <div className="bg-gray-800 dark:bg-gray-900 py-3 sm:py-4 lg:py-3 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col gap-3 sm:gap-4 lg:gap-3 pt-2 sm:pt-3 lg:pt-2">
            {/* 第一行：左侧内容和分享按钮（桌面端同一行，移动端分开） */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
              {/* 左侧：MetaMask Logo 与版权小字 */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="text-center">
                  <a
                    href="https://docs.metamask.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center hover:opacity-80 transition-opacity"
                    title="MetaMask Documentation"
                  >
                    <Image
                      src="/metamask-logo-dark.svg"
                      alt="MetaMask"
                      width={240}
                      height={80}
                      className="h-10 sm:h-12 md:h-14 lg:h-12 w-auto"
                    />
                  </a>
                  <div className="mt-2 text-[10px] sm:text-xs text-gray-300">© 2025 MetaMask • A Consensys Formation</div>
                </div>

              {/* Quickstart、Tutorials、Help、GitHub 按钮 */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                  <a
                    href="https://docs.metamask.io/quickstart/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-green-400 font-semibold text-sm sm:text-base transition-colors"
                    title="Quickstart"
                  >
                    Quickstart
                  </a>
                  <a
                    href="https://docs.metamask.io/tutorials/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-green-400 font-semibold text-sm sm:text-base transition-colors"
                    title="Tutorials"
                  >
                    Tutorials
                  </a>
                  {/* GitHub 链接 */}
                  <a
                    href="https://github.com/MetaMask/7702-livestream-demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 sm:gap-2 text-white hover:text-green-400 font-semibold text-sm sm:text-base transition-colors"
                    title="View on GitHub"
                  >
                    <Image
                      src="/github.svg"
                      alt="GitHub"
                      width={20}
                      height={20}
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="hidden sm:inline">{t.github}</span>
                    <span className="sm:hidden">GitHub</span>
                  </a>
                  <a
                    href="https://builder.metamask.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-green-400 font-semibold text-sm sm:text-base transition-colors"
                    title="Help"
                  >
                    Help ↗
                  </a>
                </div>
              </div>
            </div>

            {/* 第二行：分享按钮（右下方，并排显示） */}
            <div className="flex items-center justify-center lg:justify-end gap-2 -mt-2 lg:-mt-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                </svg>
                <span>{t.share}</span>
              </button>
              <button
                onClick={handleTweet}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>{t.tweet}</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>{t.copy}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 已移除默认 Learn/Examples/Go to nextjs.org 页脚 */}
    </div>
  );
}