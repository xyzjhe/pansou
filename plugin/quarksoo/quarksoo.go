package quarksoo

import (
	"crypto/md5"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"pansou/model"
	"pansou/plugin"
)

// 在init函数中注册插件
func init() {
	// 注册插件
	plugin.RegisterGlobalPlugin(NewQuarksooAsyncPlugin())
}

const (
	// API基础URL
	BaseURL = "https://quarksoo.cc/search.php"
	
	// 默认参数
	MaxRetries = 2
)

// 常用UA列表
var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
}

// QuarksooAsyncPlugin quarksoo网盘搜索异步插件
type QuarksooAsyncPlugin struct {
	*plugin.BaseAsyncPlugin
	retries int
}

// NewQuarksooAsyncPlugin 创建新的quarksoo异步插件
func NewQuarksooAsyncPlugin() *QuarksooAsyncPlugin {
	return &QuarksooAsyncPlugin{
		BaseAsyncPlugin: plugin.NewBaseAsyncPlugin("quarksoo", 3), // 启用Service层过滤
		retries:         MaxRetries,
	}
}

// Search 执行搜索并返回结果（兼容性方法）
func (p *QuarksooAsyncPlugin) Search(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
	result, err := p.SearchWithResult(keyword, ext)
	if err != nil {
		return nil, err
	}
	return result.Results, nil
}

// SearchWithResult 执行搜索并返回包含IsFinal标记的结果
func (p *QuarksooAsyncPlugin) SearchWithResult(keyword string, ext map[string]interface{}) (model.PluginSearchResult, error) {
	return p.AsyncSearchWithResult(keyword, p.doSearch, p.MainCacheKey, ext)
}

// doSearch 实际的搜索实现
func (p *QuarksooAsyncPlugin) doSearch(client *http.Client, keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
	// 初始化随机数种子
	rand.Seed(time.Now().UnixNano())
	
	// 构建搜索URL
	searchURL := fmt.Sprintf("%s?q=%s", BaseURL, url.QueryEscape(keyword))
	
	// 创建请求
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	
	// 设置请求头
	req.Header.Set("User-Agent", getRandomUA())
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Referer", "https://quarksoo.cc/")
	
	var resp *http.Response
	var responseBody []byte
	
	// 重试逻辑
	for i := 0; i <= p.retries; i++ {
		// 发送请求
		resp, err = client.Do(req)
		if err != nil {
			if i == p.retries {
				return nil, fmt.Errorf("请求失败: %w", err)
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}
		
		defer resp.Body.Close()
		
		// 读取响应体
		responseBody, err = io.ReadAll(resp.Body)
		if err != nil {
			if i == p.retries {
				return nil, fmt.Errorf("读取响应失败: %w", err)
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}
		
		// 状态码检查
		if resp.StatusCode != http.StatusOK {
			if i == p.retries {
				return nil, fmt.Errorf("API返回非200状态码: %d", resp.StatusCode)
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}
		
		// 请求成功，跳出重试循环
		break
	}
	
	// 解析HTML内容
	htmlContent := string(responseBody)
	results := p.parseSearchResults(htmlContent, keyword)
	
	// 去重
	uniqueResults := p.deduplicateResults(results)
	
	// 使用过滤功能过滤结果（二次过滤）
	filteredResults := plugin.FilterResultsByKeyword(uniqueResults, keyword)
	
	return filteredResults, nil
}

// parseSearchResults 从HTML中解析搜索结果
func (p *QuarksooAsyncPlugin) parseSearchResults(htmlContent string, keyword string) []model.SearchResult {
	var results []model.SearchResult
	
	// 提前过滤：检查标题是否包含关键词
	lowerKeyword := strings.ToLower(keyword)
	keywords := strings.Fields(lowerKeyword)
	
	// 使用正则表达式提取表格行
	// 匹配格式: <tr><td>剧名</td><td><a href="链接">...</a></td></tr>
	// 注意处理可能的空白字符
	pattern := `<tr>\s*<td>([^<]+)</td>\s*<td>\s*<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>`
	re := regexp.MustCompile(pattern)
	matches := re.FindAllStringSubmatch(htmlContent, -1)
	
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		
		title := strings.TrimSpace(match[1])
		linkURL := strings.TrimSpace(match[2])
		
		// 跳过表头（如果匹配到）
		if strings.Contains(title, "剧名") || strings.Contains(title, "网盘链接") {
			continue
		}
		
		// 验证链接是否为夸克网盘
		if !strings.Contains(linkURL, "pan.qoark.cn") && !strings.Contains(linkURL, "pan.quark.cn") {
			continue
		}
		
		// 检查标题是否包含关键词（提前过滤）
		lowerTitle := strings.ToLower(title)
		titleMatched := true
		for _, kw := range keywords {
			if !strings.Contains(lowerTitle, kw) {
				titleMatched = false
				break
			}
		}
		if !titleMatched {
			continue
		}
		
		// 识别网盘类型
		linkType := "quark"
		
		// 生成唯一ID：使用标题和链接的MD5哈希
		uniqueIDKey := fmt.Sprintf("%s|%s", title, linkURL)
		hash := md5.Sum([]byte(uniqueIDKey))
		uniqueID := fmt.Sprintf("quarksoo-%x", hash[:8]) // 使用前8字节作为ID
		
		result := model.SearchResult{
			UniqueID: uniqueID,
			Title:    title,
			Links: []model.Link{
				{
					Type:     linkType,
					URL:      linkURL,
					Password: "", // 无密码
				},
			},
			Channel:  "", // 插件搜索结果Channel为空
			Datetime: time.Now(), // 页面无时间信息，使用当前时间
		}
		
		results = append(results, result)
	}
	
	return results
}

// deduplicateResults 去除重复结果
func (p *QuarksooAsyncPlugin) deduplicateResults(results []model.SearchResult) []model.SearchResult {
	seen := make(map[string]bool)
	unique := make([]model.SearchResult, 0, len(results))
	
	for _, result := range results {
		// 使用UniqueID进行去重
		if !seen[result.UniqueID] {
			seen[result.UniqueID] = true
			unique = append(unique, result)
		}
	}
	
	// 按标题排序（保持一致性）
	sort.Slice(unique, func(i, j int) bool {
		return unique[i].Title < unique[j].Title
	})
	
	return unique
}

// 生成随机IP
func generateRandomIP() string {
	return fmt.Sprintf("%d.%d.%d.%d", 
		rand.Intn(223)+1,  // 避免0和255
		rand.Intn(255),
		rand.Intn(255),
		rand.Intn(254)+1)  // 避免0
}

// 获取随机UA
func getRandomUA() string {
	return userAgents[rand.Intn(len(userAgents))]
}
