-- テーブルの構造 `subscriptions`
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `plan_id` varchar(255) NOT NULL,
  `fincode_customer_id` varchar(255) NOT NULL,
  `fincode_card_id` varchar(255) DEFAULT NULL,
  `fincode_subscription_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `start_date` date DEFAULT NULL,
  `next_charge_date` date DEFAULT NULL,
  `cancel_at` date DEFAULT NULL,
  `raw_payload` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

-- テーブルの構造 `users`
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `fincode_customer_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

-- テーブルのデータのダンプ `users`
INSERT INTO `users` (`id`, `email`, `password`, `fincode_customer_id`, `created_at`) VALUES
(1, 'ryotamti@icloud.com', '$2y$10$z8ydZaLWAUWSrbBpCUhN1.p/jAWQUPFmJq1WgKnRKBSjStGTM/Ysa', NULL, '2025-12-02 01:15:19');

-- --------------------------------------------------------

-- テーブルのインデックス `subscriptions`
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_subscription` (`user_id`),
  ADD KEY `idx_fincode_subscription_id` (`fincode_subscription_id`);

-- テーブルのインデックス `users`
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uniq_fincode_customer_id` (`fincode_customer_id`);

-- --------------------------------------------------------

-- ダンプしたテーブルの AUTO_INCREMENT
ALTER TABLE `subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

-- --------------------------------------------------------

-- テーブルの制約 `subscriptions`
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;
