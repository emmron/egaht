export class StructuredDataGenerator {
  constructor(config = {}) {
    this.config = {
      siteName: 'Eghact App',
      siteUrl: process.env.SITE_URL || 'https://example.com',
      defaultAuthor: config.defaultAuthor,
      organization: config.organization,
      ...config
    };
  }

  generateWebsiteStructuredData() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.config.siteName,
      url: this.config.siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${this.config.siteUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    };
  }

  generateOrganizationStructuredData(org = this.config.organization) {
    if (!org) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: org.name,
      url: org.url || this.config.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: org.logo
      },
      description: org.description,
      contactPoint: org.contactPoint ? {
        '@type': 'ContactPoint',
        telephone: org.contactPoint.phone,
        contactType: org.contactPoint.type || 'customer service',
        email: org.contactPoint.email
      } : undefined,
      address: org.address ? {
        '@type': 'PostalAddress',
        streetAddress: org.address.street,
        addressLocality: org.address.city,
        addressRegion: org.address.state,
        postalCode: org.address.zip,
        addressCountry: org.address.country
      } : undefined,
      sameAs: org.socialLinks || []
    };
  }

  generateArticleStructuredData(article) {
    const author = this.generatePersonStructuredData(
      article.author || this.config.defaultAuthor
    );

    const publisher = this.config.organization ? 
      this.generateOrganizationStructuredData() : 
      author;

    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.description || article.excerpt,
      image: article.image ? {
        '@type': 'ImageObject',
        url: article.image,
        width: article.imageWidth,
        height: article.imageHeight
      } : undefined,
      author,
      publisher,
      datePublished: article.publishedAt,
      dateModified: article.modifiedAt || article.publishedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${this.config.siteUrl}${article.url}`
      },
      articleSection: article.category,
      keywords: Array.isArray(article.tags) ? article.tags.join(', ') : article.tags,
      wordCount: article.wordCount,
      articleBody: article.content
    };
  }

  generateBlogPostingStructuredData(post) {
    const articleData = this.generateArticleStructuredData(post);
    return {
      ...articleData,
      '@type': 'BlogPosting'
    };
  }

  generatePersonStructuredData(person) {
    if (typeof person === 'string') {
      return {
        '@type': 'Person',
        name: person
      };
    }

    return {
      '@type': 'Person',
      name: person.name,
      url: person.url,
      image: person.image,
      description: person.bio,
      sameAs: person.socialLinks || [],
      jobTitle: person.jobTitle,
      worksFor: person.organization ? {
        '@type': 'Organization',
        name: person.organization
      } : undefined
    };
  }

  generateProductStructuredData(product) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.images || product.image,
      brand: product.brand ? {
        '@type': 'Brand',
        name: product.brand
      } : undefined,
      model: product.model,
      sku: product.sku,
      gtin: product.gtin,
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: product.currency || 'USD',
        availability: this.mapAvailability(product.availability),
        priceValidUntil: product.priceValidUntil,
        seller: {
          '@type': 'Organization',
          name: this.config.siteName
        },
        url: `${this.config.siteUrl}${product.url}`
      },
      aggregateRating: product.rating ? {
        '@type': 'AggregateRating',
        ratingValue: product.rating.average,
        reviewCount: product.rating.count,
        bestRating: product.rating.max || 5,
        worstRating: product.rating.min || 1
      } : undefined,
      review: product.reviews ? product.reviews.map(review => ({
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5
        },
        author: {
          '@type': 'Person',
          name: review.author
        },
        reviewBody: review.content,
        datePublished: review.date
      })) : undefined
    };
  }

  generateEventStructuredData(event) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.name,
      description: event.description,
      image: event.image,
      startDate: event.startDate,
      endDate: event.endDate,
      eventStatus: this.mapEventStatus(event.status),
      eventAttendanceMode: this.mapAttendanceMode(event.attendanceMode),
      location: event.location ? {
        '@type': event.location.virtual ? 'VirtualLocation' : 'Place',
        name: event.location.name,
        address: event.location.virtual ? undefined : {
          '@type': 'PostalAddress',
          streetAddress: event.location.address?.street,
          addressLocality: event.location.address?.city,
          addressRegion: event.location.address?.state,
          postalCode: event.location.address?.zip,
          addressCountry: event.location.address?.country
        },
        url: event.location.virtual ? event.location.url : undefined
      } : undefined,
      organizer: event.organizer ? {
        '@type': 'Organization',
        name: event.organizer.name,
        url: event.organizer.url
      } : undefined,
      offers: event.offers ? {
        '@type': 'Offer',
        price: event.offers.price,
        priceCurrency: event.offers.currency || 'USD',
        availability: 'https://schema.org/InStock',
        url: event.offers.url
      } : undefined
    };
  }

  generateRecipeStructuredData(recipe) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.name,
      description: recipe.description,
      image: recipe.image,
      author: this.generatePersonStructuredData(recipe.author),
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      recipeYield: recipe.servings,
      recipeCategory: recipe.category,
      recipeCuisine: recipe.cuisine,
      keywords: recipe.keywords,
      recipeIngredient: recipe.ingredients,
      recipeInstructions: recipe.instructions.map(instruction => ({
        '@type': 'HowToStep',
        text: instruction.text,
        image: instruction.image
      })),
      nutrition: recipe.nutrition ? {
        '@type': 'NutritionInformation',
        calories: recipe.nutrition.calories,
        proteinContent: recipe.nutrition.protein,
        fatContent: recipe.nutrition.fat,
        carbohydrateContent: recipe.nutrition.carbs
      } : undefined,
      aggregateRating: recipe.rating ? {
        '@type': 'AggregateRating',
        ratingValue: recipe.rating.average,
        reviewCount: recipe.rating.count
      } : undefined
    };
  }

  generateBreadcrumbStructuredData(breadcrumbs) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${this.config.siteUrl}${crumb.url}`
      }))
    };
  }

  generateFAQStructuredData(faqs) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };
  }

  generateVideoStructuredData(video) {
    return {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnail,
      uploadDate: video.uploadDate,
      duration: video.duration,
      contentUrl: video.url,
      embedUrl: video.embedUrl,
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/WatchAction',
        userInteractionCount: video.viewCount
      }
    };
  }

  generateLocalBusinessStructuredData(business) {
    return {
      '@context': 'https://schema.org',
      '@type': business.type || 'LocalBusiness',
      name: business.name,
      description: business.description,
      image: business.image,
      url: business.url || this.config.siteUrl,
      telephone: business.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: business.address.street,
        addressLocality: business.address.city,
        addressRegion: business.address.state,
        postalCode: business.address.zip,
        addressCountry: business.address.country
      },
      geo: business.coordinates ? {
        '@type': 'GeoCoordinates',
        latitude: business.coordinates.lat,
        longitude: business.coordinates.lng
      } : undefined,
      openingHoursSpecification: business.hours ? business.hours.map(hour => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hour.days,
        opens: hour.open,
        closes: hour.close
      })) : undefined,
      priceRange: business.priceRange,
      aggregateRating: business.rating ? {
        '@type': 'AggregateRating',
        ratingValue: business.rating.average,
        reviewCount: business.rating.count
      } : undefined
    };
  }

  // Utility methods

  mapAvailability(availability) {
    const mapping = {
      'in_stock': 'https://schema.org/InStock',
      'out_of_stock': 'https://schema.org/OutOfStock',
      'preorder': 'https://schema.org/PreOrder',
      'discontinued': 'https://schema.org/Discontinued'
    };
    return mapping[availability] || 'https://schema.org/InStock';
  }

  mapEventStatus(status) {
    const mapping = {
      'scheduled': 'https://schema.org/EventScheduled',
      'cancelled': 'https://schema.org/EventCancelled',
      'postponed': 'https://schema.org/EventPostponed',
      'rescheduled': 'https://schema.org/EventRescheduled'
    };
    return mapping[status] || 'https://schema.org/EventScheduled';
  }

  mapAttendanceMode(mode) {
    const mapping = {
      'online': 'https://schema.org/OnlineEventAttendanceMode',
      'offline': 'https://schema.org/OfflineEventAttendanceMode',
      'mixed': 'https://schema.org/MixedEventAttendanceMode'
    };
    return mapping[mode] || 'https://schema.org/OfflineEventAttendanceMode';
  }

  // Validation

  validateStructuredData(data) {
    const errors = [];
    const warnings = [];

    // Check required @context
    if (!data['@context']) {
      errors.push('Missing @context property');
    } else if (data['@context'] !== 'https://schema.org') {
      warnings.push('Recommended to use https://schema.org as @context');
    }

    // Check required @type
    if (!data['@type']) {
      errors.push('Missing @type property');
    }

    // Type-specific validation
    if (data['@type'] === 'Article') {
      if (!data.headline) errors.push('Article missing required headline');
      if (!data.author) errors.push('Article missing required author');
      if (!data.datePublished) errors.push('Article missing required datePublished');
    }

    if (data['@type'] === 'Product') {
      if (!data.name) errors.push('Product missing required name');
      if (!data.offers) errors.push('Product missing required offers');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Output formatting

  toJsonLd(data) {
    return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`;
  }

  combineStructuredData(dataArray) {
    if (dataArray.length === 1) {
      return dataArray[0];
    }

    return {
      '@context': 'https://schema.org',
      '@graph': dataArray
    };
  }
}